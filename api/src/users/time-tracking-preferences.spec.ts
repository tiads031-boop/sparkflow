import { BadRequestException } from '@nestjs/common';
import {
  parseTimeTrackingPreferences,
  validateTimeTrackingPatch,
} from './time-tracking-preferences';

describe('Time tracking preferences', () => {
  it('defaults legacy settings and preserves explicitly disabled choices', () => {
    expect(parseTimeTrackingPreferences({}).focusActualEnabled).toBe(true);
    expect(
      parseTimeTrackingPreferences({
        timeTracking: {
          focusActualEnabled: false,
          manualBackfillEnabled: false,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        focusActualEnabled: false,
        manualBackfillEnabled: false,
        quickStartEnabled: true,
      }),
    );
  });

  it('accepts only writable fields with exact value types', () => {
    expect(
      validateTimeTrackingPatch({
        defaultSceneId: null,
        focusActualEnabled: false,
      }),
    ).toEqual({ defaultSceneId: null, focusActualEnabled: false });
    expect(() =>
      validateTimeTrackingPatch({ focusActualEnabled: 'false' }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateTimeTrackingPatch({
        externalSources: { androidUsage: 'connected' },
      }),
    ).toThrow(BadRequestException);
  });
});
