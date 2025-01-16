function pacs --wraps='sudo pacman -S' --description 'alias pacs sudo pacman -S'
  sudo pacman -S $argv
        
end
