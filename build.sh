#!/bin/bash

cp src/p2p_utils/redbean.com dist/base/redbean.com
cd dist/base/
rm index.html
mv example.html index.html
zip -r redbean.com utils/ blood.css custom-style.css full.iife.js index.html reveal.css reveal.js textSize.json white.css
cd ../../
echo "Redbean setup completed!"