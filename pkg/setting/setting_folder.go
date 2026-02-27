package setting

import (
	"gopkg.in/ini.v1"
)

const MaxNestedFolderDepth = 7
const DefaultMaxNestedFolderDepth = 4

func maxDeptFolderSettings(iniFile *ini.File) int {
	if iniFile == nil {
		return DefaultMaxNestedFolderDepth
	}

	folderSection := iniFile.Section("folder")
	cfgMaxNestedFolderDepth := folderSection.Key("max_nested_folder_depth").MustInt(DefaultMaxNestedFolderDepth)
	if cfgMaxNestedFolderDepth > MaxNestedFolderDepth {
		cfgMaxNestedFolderDepth = MaxNestedFolderDepth
	}

	if cfgMaxNestedFolderDepth <= 0 {
		cfgMaxNestedFolderDepth = DefaultMaxNestedFolderDepth
	}

	return cfgMaxNestedFolderDepth
}
