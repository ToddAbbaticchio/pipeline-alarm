# Change Log
All notable changes to the "pipeline-alarm" extension will be documented in this file.

## [0.1.1] - 09/17/2025
### Added
- Support for updating settings file through File > Preferences > Pipeline Alarm menu in VSCode
- Support for pipeline_id OR pipeline_url to start monitoring
### Changed
- Enhanced messaging when unable to resolve workspace path via the vscode workspace API
- Updated status bar message during Alarm
- Changed toast warning to modal during alarm (so the option to stop the alarm isn't dismissed after ~5 seconds.)


## [Unreleased]
- Initial release