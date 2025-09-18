import * as vscode from 'vscode';
import { exec, ChildProcess } from 'child_process';
import * as path from 'path';

let currentMonitoringProcess: ChildProcess | null = null;
let currentStatus = 'Idle';
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('PipelineAlarm extension is activating...');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
    updateStatusBar();
    statusBarItem.show();

    // Start monitoring command
    let startCommand = vscode.commands.registerCommand('pipelineAlarm.startMonitoring', async () => {
        if (currentStatus === 'Monitoring') {
            vscode.window.showWarningMessage('Pipeline monitoring is already running. Cancel it first to start a new one.');
            return;
        }

        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (!pythonExtension) {
                vscode.window.showErrorMessage('Python extension not found. Please install the Python extension.');
                return;
            }

            if (!pythonExtension.isActive) {
                await pythonExtension.activate();
            }

            const pythonApi = pythonExtension.exports;
            const pythonPath = await pythonApi.settings.getExecutionDetails(vscode.workspace.workspaceFolders?.[0]?.uri);

            const pipelineId = await vscode.window.showInputBox({
                prompt: 'Enter Pipeline ID or URL',
                placeHolder: 'e.g., 12345 or https://gitlab.com/project/-/pipelines/12345',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Pipeline ID cannot be empty';
                    }
                    return null;
                }
            });

            if (!pipelineId) {
                return;
            }

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
            const scriptPath = path.join(context.extensionPath, 'scripts', 'pipeline_alarm.py');
            const settingsPath = path.join(workspaceRoot, '.vscode', 'settings.json');
            const command = `"${pythonPath.execCommand[0]}" "${scriptPath}" "${pipelineId.trim()}" "${settingsPath}"`;
            currentStatus = 'Monitoring';
            updateStatusBar();

            const outputChannel = vscode.window.createOutputChannel('Pipeline Alarm');
            outputChannel.show(true);
            outputChannel.appendLine(`Resolved settingsPath: ${settingsPath}`);
            outputChannel.appendLine(`Starting pipeline monitoring for: ${pipelineId}`);
            outputChannel.appendLine('---');

            currentMonitoringProcess = exec(command, {
                cwd: workspaceRoot,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: 'utf-8'
                }
            });

            currentMonitoringProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                outputChannel.append(output);

                if (output.includes('ALARM!')) {
                    currentStatus = 'Alarm';
                    updateStatusBar();
                    const modal = vscode.window.showWarningMessage(
                        'Pipeline completed! Alarm is sounding.',
                        { modal: true },
                        'Stop Alarm'
                    ).then(selection => {
                        if (selection === 'Stop Alarm' && currentMonitoringProcess) {
                            currentMonitoringProcess.stdin?.write('STOP_ALARM\n');
                        }
                    });
                }
            });

            currentMonitoringProcess.stderr?.on('data', (data) => {
                const errorOutput = data.toString();
                outputChannel.append(`ERROR: ${errorOutput}`);
            });

            currentMonitoringProcess.on('close', (code) => {
                currentStatus = 'Idle';
                updateStatusBar();
                currentMonitoringProcess = null;

                if (code === 0) {
                    outputChannel.appendLine('Pipeline monitoring completed successfully!');
                } else if (code !== null) {
                    outputChannel.appendLine(`Pipeline monitoring exited with code: ${code}`);
                } else {
                    outputChannel.appendLine('Pipeline monitoring was cancelled.');
                }
            });

            currentMonitoringProcess.on('error', (error) => {
                currentStatus = 'Idle';
                updateStatusBar();
                currentMonitoringProcess = null;
                outputChannel.appendLine(`Process error: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to start pipeline monitoring: ${error.message}`);
            });

        } catch (error) {
            currentStatus = 'Idle';
            updateStatusBar();
            vscode.window.showErrorMessage(`Failed to start pipeline monitoring: ${error}`);
        }
    });

    // Stop monitoring command
    let stopCommand = vscode.commands.registerCommand('pipelineAlarm.stopMonitoring', () => {
        if (currentMonitoringProcess && currentStatus === 'Monitoring') {
            console.log('Stopping pipeline monitoring...');
            currentMonitoringProcess.stdin?.write('STOP_ALARM\n');
            currentMonitoringProcess = null;
        } else {
            vscode.window.showInformationMessage('No pipeline monitoring is currently running.');
        }
    });

    function updateStatusBar() {
        if (currentStatus === 'Monitoring') {
            statusBarItem.text = '$(loading~spin) Stop Pipeline Monitor';
            statusBarItem.command = 'pipelineAlarm.stopMonitoring';
            statusBarItem.tooltip = 'Click to stop pipeline monitoring';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            return;
        }

        if (currentStatus === 'Alarm') {
            statusBarItem.text = '$(alert) SHE DONE!!!';
            statusBarItem.command = 'pipelineAlarm.stopMonitoring';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            return;
        }

        statusBarItem.text = '$(play) Start Pipeline Monitor';
        statusBarItem.command = 'pipelineAlarm.startMonitoring';
        statusBarItem.tooltip = 'Click to start monitoring a GitLab pipeline';
        statusBarItem.backgroundColor = undefined;
    }

    context.subscriptions.push(startCommand, stopCommand, statusBarItem);
}

export function deactivate() {
    if (currentMonitoringProcess) {
        currentMonitoringProcess.kill('SIGTERM');
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
