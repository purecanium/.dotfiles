function yays --wraps='sudo yay -S' --wraps='yay -S' --wraps='yay -S --noconfirm --needed' --description 'alias yays yay -S --noconfirm --needed'
  yay -S --noconfirm --needed $argv
        
end
