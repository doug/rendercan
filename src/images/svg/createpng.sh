rm ../*.png
for name in default recording recording-pulse saving; do
  for sz in 128 38; do
    convert -background none icon-$name.svg -resize $sz ../icon-$name-$sz.png
  done
done

