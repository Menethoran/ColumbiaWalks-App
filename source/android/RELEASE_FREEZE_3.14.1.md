# ColumbiaWalks 3.14.1 release freeze

## Status

The freeze has been prepared but does not start until the signed 3.14.1 AAB is
rolled out to the Google Play closed-testing track.

## Rule

Once rollout begins, 3.14.1 is the fixed test candidate. Do not change app code,
versioned release copy, or the signed APK/AAB while the candidate is under
review. Keep the Play closed-testing track active; do not use Play Console's
**Pause track** control, because testers must remain continuously opted in.

The freeze ends at the earlier of:

1. Google Play grants production access and the tested 3.14.1 candidate is
   cleared for the next release step; or
2. thirty calendar days after the closed-testing rollout starts.

Record the actual start and deadline below immediately after rollout:

- Closed-testing rollout start: `PENDING`
- Thirty-day deadline: `PENDING`
- Production-access clearance: `PENDING`

## Exceptions

Only a security, privacy, data-loss, crash, or Play-policy defect that blocks
testing may break the freeze. Any exception must use a higher version code, have
written release notes, and restart the applicable tester/review evaluation when
Google Play requires it. Never replace a published artifact under the same
version or checksum.

