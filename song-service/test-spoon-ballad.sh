#!/bin/bash

curl -s -X POST https://pd08901pf7.execute-api.us-east-1.amazonaws.com/prod/fal/test \
  -H "Content-Type: application/json" \
  -d @- <<EOF | jq
{
  "model": "fal-ai/diffrhythm",
  "lyrics": "[verse]\nIn the kitchen of King Arthur's greatest knight\nLived a spoon of silver, shining bright\nSir Wiggleton was his noble name\nDestined for culinary fame!\n\n[chorus]\nOh Wiggleton, brave Wiggleton\nYour handle gleams in morning sun\nFrom cereal bowls to royal stew\nThere's no one quite as stirring as you!\n\n[verse]\nHe stirred the soup with valor true\nHe mixed the batter, through and through\nNo bowl too deep, no pot too wide\nSir Wiggleton stirred with knightly pride!",
  "genres": "epic, orchestral, heroic"
}
EOF