function disablenow --wraps='sudo systemctl disable --now' --description 'alias disablenow sudo systemctl disable --now'
  sudo systemctl disable --now $argv
        
end
