#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

alias ls='ls --color=auto'
alias grep='grep --color=auto'
PS1='[\u@\h \W]\$ '

# xdg-ninja
alias wget="wget --hsts-file=$XDG_DATA_HOME/wget-hsts"

if [[ $(ps --no-header --pid=$PPID --format=comm) != "fish" && -z ${BASH_EXECUTION_STRING} ]]
then
	shopt -q login_shell && LOGIN_OPTION='--login' || LOGIN_OPTION=''
	exec fish $LOGIN_OPTION
fi
