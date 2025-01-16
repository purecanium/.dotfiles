function enablenow --wraps='sudo systemctl enable --now' --description 'alias enablenow sudo systemctl enable --now'
  sudo systemctl enable --now $argv
        
end
