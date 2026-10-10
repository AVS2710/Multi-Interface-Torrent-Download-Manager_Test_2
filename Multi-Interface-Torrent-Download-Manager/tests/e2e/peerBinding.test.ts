import { test } from '@playwright/test';

// The current @porla/libtorrent binding does not expose peer_info/local-endpoint
// details needed to prove the remote peer's physical interface. Do not report this
// as a pass based on a placeholder assertion; retain it as an explicit limitation.
test.skip('Real Multi-Interface Peer Connections: physical peer binding verification', async () => {
  throw new Error('Unreachable: test is explicitly skipped until the binding exposes peer/local-endpoint data.');
});
