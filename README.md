# Pipeline Alarm
Monitor GitLab pipelines and sound an alarm when they complete.

## Features
- Monitor GitLab pipelines by ID or URL
- Sound an alarm when pipelines complete
- Configurable GitLab API settings
- Status bar integration

## Installation
1. Download latest release from [Releases](https://github.com/ToddAbbaticchio/pipeline-alarm/releases)
2. In VSCode open Command Palette (ctrl+shift+p) and select 'Extensions: Install from VSIX'
   Install from VS Code Marketplace (coming soon? If I feel like it the hoopjumping to get a publisher account created/approved)

## Configuration
Configure the extension through VS Code settings:
- `pipelineAlarm.gitlabApiBase`: GitLab API base URL
- `pipelineAlarm.projectId`: Your GitLab project ID
- `pipelineAlarm.personalAccessToken`: Your GitLab personal access token

## Usage
1. Click the 'Start Pipeline Monitor' status button in the lower left
2. Enter a pipeline ID or URL when prompted
3. ???
4. Profit.  The extension will monitor and alarm when complete 

## Release Notes
See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License
MIT License - see [LICENSE](LICENSE) file for details.