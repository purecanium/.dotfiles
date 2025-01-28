#
# ~/.bash_profile
#

export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"
export XDG_BIN_HOME="$HOME/.local/bin"

export QT_QPA_PLATFORMTHEME=qt6ct
export QT_QPA_PLATFORM=xcb obs

export ANDROID_HOME=~/Android/Sdk
export ANDROID_USER_HOME=$HOME/.android
export PATH=$PATH:$ANDROID_HOME/platforms:$ANDROID_HOME/platform-tools
export PATH=$PATH:$HOME/.local/bin

export MOLD_JOBS=1
export CARGO_TARGET_DIR=/tmp/mytarget

#sudo chcpu -d 8-11
#sudo cpupower frequency-set -g powersave -u 1.4G

# xdg-ninja
export DOTNET_CLI_HOME="$XDG_DATA_HOME"/dotnet
export NUGET_PACKAGES="$XDG_CACHE_HOME"/NuGetPackages
export GNUPGHOME="$XDG_DATA_HOME"/gnupg


[[ -f ~/.bashrc ]] && . ~/.bashrc

