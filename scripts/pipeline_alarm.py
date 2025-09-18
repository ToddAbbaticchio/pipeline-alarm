import requests
import sys
import time
import threading
import os
import json

stop_all = threading.Event()
beep_thread = None
GITLAB_API_BASE = None
PROJECT_ID = None
PAT = None

def listen_for_stop():
    for line in sys.stdin:
        if stop_all.is_set():
            break

        if line.strip() == "STOP_ALARM":
            stop_all.set()
            break

def get_config(settings_path:str) -> None:
    """Get configuration from VS Code settings or fallback to environment variables"""
    global GITLAB_API_BASE, PROJECT_ID, PAT
    
    if os.path.exists(settings_path):
        try:
            with open(settings_path, 'r') as f:
                settings = json.load(f)
                GITLAB_API_BASE = settings.get('pipelineAlarm.gitlabApiBase') or os.getenv('GITLAB_API_BASE', 'https://oxford.awsdev.infor.com/api/v4')
                PROJECT_ID = settings.get('pipelineAlarm.projectId') or os.getenv('PROJECT_ID', '20275')
                PAT = settings.get('pipelineAlarm.personalAccessToken') or os.getenv('GITLAB_PAT')
        except (json.JSONDecodeError, KeyError):
            pass

    if not PAT:
        raise ValueError("Personal Access Token not found. Set pipelineAlarm.personalAccessToken in VS Code settings or GITLAB_PAT environment variable.")

def _get_pipeline_status(pipeline_id) -> dict:
    response = requests.get(f'{GITLAB_API_BASE}/projects/{PROJECT_ID}/pipelines/{pipeline_id}', headers={'PRIVATE-TOKEN': PAT})
    if not response.ok:
        raise Exception(f"Pipeline {pipeline_id} not found")

    pipeline = response.json()
    return pipeline

def _alarm():
    """Sound alarm for a specific duration with proper stopping mechanism"""
    global beep_thread
    print("ALARM! Pipeline is no longer running...", flush=True)

    def _beep_loop():
        is_windows = sys.platform.startswith('win')
        if is_windows:
            import winsound

        while not stop_all.is_set():
            if is_windows:
                winsound.Beep(1000, 500)
            else:
                os.system('tput bel')

            time.sleep(.5)
        exit(0)

    beep_thread = threading.Thread(target=_beep_loop, daemon=True)
    beep_thread.start()

def await_pipeline_completion(pipeline_id_or_url, wait_interval=30, max_attempts=60) -> dict:
    start_time = time.time()
    inactive_statuses = {'success', 'manual', 'failed', 'canceled', 'skipped'}

    pipeline_id = pipeline_id_or_url.rstrip('/').split('/')[-1] if '/' in pipeline_id_or_url else pipeline_id_or_url

    result = _get_pipeline_status(pipeline_id)
    status = result.get('status')

    for attempt in range(1, max_attempts + 1):
        if stop_all.is_set():
            print("Monitoring stopped by user.")
            return

        try:
            if status in inactive_statuses:
                match(status):
                    case 'success':
                        print(f"[SUCCESS] Pipeline {pipeline_id} completed successfully!")
                    case 'manual':
                        print(f"[MANUAL] Pipeline {pipeline_id} is paused, awaiting manual action")
                    case 'failed':
                        print(f"[FAILED] Pipeline {pipeline_id} failed")
                    case 'canceled':
                        print(f"[CANCELED] Pipeline {pipeline_id} was canceled")
                    case 'skipped':
                        print(f"[SKIPPED] Pipeline {pipeline_id} was skipped")

                elapsed_time = time.time() - start_time
                print(f'Elapsed time: {elapsed_time:.1f} seconds')
                _alarm()
                beep_thread.join()
                return

            for _ in range(wait_interval):
                if stop_all.is_set():
                    return
                time.sleep(1)

            result = _get_pipeline_status(pipeline_id)
            status = result.get('status')
            print(f"Attempt {attempt}/{max_attempts}: Pipeline {pipeline_id} status: {status}")

        except requests.RequestException as e:
            print(f"Network error on attempt {attempt}: {e}")
            if attempt < max_attempts:
                print(f"Retrying in {wait_interval} seconds...")
                for i in range(wait_interval):
                    if stop_all.is_set():
                        return
                    time.sleep(1)
            else:
                raise

    raise Exception(f"Pipeline {pipeline_id} monitoring timed out after {max_attempts} attempts ({max_attempts * wait_interval / 60:.1f} minutes)")

if __name__ == '__main__':
    try:
        pipeline_id = sys.argv[1]
        settings_path = sys.argv[2]

        get_config(settings_path)
        listener_thread = threading.Thread(target=listen_for_stop, daemon=True)
        listener_thread.start()
        await_pipeline_completion(sys.argv[1])

    except KeyboardInterrupt:
        print("\nMonitoring interrupted by user.")
        stop_all.set()
    except Exception as e:
        print(f"Error: {e}")
        stop_all.set()
        sys.exit(1)
