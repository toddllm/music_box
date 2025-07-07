#!/bin/bash
# WebSocket Smoke Test Suite

WSS_URL="wss://music-box-realtime-alb-417242201.us-east-1.elb.amazonaws.com/"
RESULTS_FILE="smoke-test-results.txt"

echo "=== WebSocket Smoke Test Suite ===" | tee $RESULTS_FILE
echo "Target: $WSS_URL" | tee -a $RESULTS_FILE
echo "Started: $(date)" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Test 1: Handshake test - verify 101 response
echo "Test 1: WebSocket Handshake" | tee -a $RESULTS_FILE
for i in {1..5}; do
  echo -n "  Attempt $i: " | tee -a $RESULTS_FILE
  if curl --http1.1 -k -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
    -H "Sec-WebSocket-Version: 13" \
    https://music-box-realtime-alb-417242201.us-east-1.elb.amazonaws.com/ | grep -q "101"; then
    echo "✓ 101 Switching Protocols" | tee -a $RESULTS_FILE
  else
    echo "✗ Failed to get 101 response" | tee -a $RESULTS_FILE
  fi
  sleep 1
done
echo "" | tee -a $RESULTS_FILE

# Test 2: Echo path test
echo "Test 2: Echo Path (ping/pong)" | tee -a $RESULTS_FILE
echo '{"type":"ping"}' | timeout 5s npx wscat -c $WSS_URL --no-check 2>&1 | grep -q "pong" && \
  echo "  ✓ Ping/pong working" | tee -a $RESULTS_FILE || \
  echo "  ✗ Ping/pong failed" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Test 3: Invalid JSON handling
echo "Test 3: Invalid JSON Handling" | tee -a $RESULTS_FILE
echo 'blahblah' | timeout 5s npx wscat -c $WSS_URL --no-check 2>&1 | grep -q "error" && \
  echo "  ✓ Invalid JSON handled gracefully" | tee -a $RESULTS_FILE || \
  echo "  ✗ Invalid JSON handling failed" | tee -a $RESULTS_FILE
echo "" | tee -a $RESULTS_FILE

# Test 4: Multiple connections
echo "Test 4: Multiple Concurrent Connections" | tee -a $RESULTS_FILE
for i in {1..3}; do
  (echo '{"type":"ping"}' | timeout 3s npx wscat -c $WSS_URL --no-check >/dev/null 2>&1 && echo "  ✓ Connection $i successful" | tee -a $RESULTS_FILE) &
done
wait
echo "" | tee -a $RESULTS_FILE

# Test 5: Check HTTP endpoint
echo "Test 5: HTTP Status Endpoint" | tee -a $RESULTS_FILE
HTTP_RESPONSE=$(curl -k -s https://music-box-realtime-alb-417242201.us-east-1.elb.amazonaws.com/)
if echo "$HTTP_RESPONSE" | jq -e '.service' >/dev/null 2>&1; then
  echo "  ✓ HTTP endpoint returns valid JSON" | tee -a $RESULTS_FILE
  echo "  Service: $(echo "$HTTP_RESPONSE" | jq -r '.service')" | tee -a $RESULTS_FILE
  echo "  Status: $(echo "$HTTP_RESPONSE" | jq -r '.status')" | tee -a $RESULTS_FILE
  echo "  Connections: $(echo "$HTTP_RESPONSE" | jq -r '.connections')" | tee -a $RESULTS_FILE
else
  echo "  ✗ HTTP endpoint failed" | tee -a $RESULTS_FILE
fi
echo "" | tee -a $RESULTS_FILE

echo "=== Smoke Test Complete ===" | tee -a $RESULTS_FILE
echo "Completed: $(date)" | tee -a $RESULTS_FILE