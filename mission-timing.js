// Pure mission timing calculation engine.
// No DOM, no React, no globals — safe to import in both app and test suite.

export const APP_VERSION = '1.5.7';

export const REGS = {
  crewRestHours: 12,          // AFMAN 11-202V3 para 3.1
  fdpLfaBufferHours: 1,       // AFMAN 11-202V3_AMCSUP para 3.2.1
  fdpBasicHours: 16,          // AFMAN 11-202V3_AMCSUP Table 3.1
  fdpAugmentedHours: 24,      // AFMAN 11-202V3_AMCSUP Table 3.1
  checkInBeforeStartMin: 5,
  intervals: {
    Summer: {
      lfaToTO:        { hours: 4, minutes: 15 },
      showToTO:       { hours: 3, minutes: 15 },
      stepSingleToTO: { hours: 1, minutes: 45 },
      stepFormToTO:   { hours: 2, minutes:  0 },
      startToTO:      { hours: 0, minutes: 25 }
    },
    Winter: {
      lfaToTO:        { hours: 4, minutes: 45 },
      showToTO:       { hours: 3, minutes: 45 },
      stepSingleToTO: { hours: 2, minutes:  0 },
      stepFormToTO:   { hours: 2, minutes:  0 },
      startToTO:      { hours: 0, minutes: 30 }
    }
  }
};

export const formatDuration = (totalMin) => {
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h + '+' + String(m).padStart(2, '0');
};

export function getIntervals(season, formationType) {
  const s = REGS.intervals[season];
  return {
    lfaToTO:  s.lfaToTO,
    showToTO: s.showToTO,
    stepToTO: formationType === 'Single Ship' ? s.stepSingleToTO : s.stepFormToTO,
    startToTO: s.startToTO
  };
}

// DateTime is passed in from the caller so this module stays free of CDN globals.

export function parseTime(DateTime, timeStr, inputTimezone, timezone, referenceDT = null) {
  if (!timeStr || timeStr.length !== 4) return null;
  const hours = parseInt(timeStr.substring(0, 2), 10);
  const minutes = parseInt(timeStr.substring(2, 4), 10);
  if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) return null;

  if (inputTimezone === 'Z') {
    const utcBase = referenceDT ? referenceDT.toUTC() : DateTime.utc();
    return DateTime.utc(utcBase.year, utcBase.month, utcBase.day, hours, minutes).setZone(timezone);
  }
  const baseDate = referenceDT || DateTime.now().setZone(timezone);
  return DateTime.fromObject(
    { year: baseDate.year, month: baseDate.month, day: baseDate.day, hour: hours, minute: minutes },
    { zone: timezone }
  );
}

// Resolve a user-entered time relative to a reference DateTime.
// direction 'before': step back one day if parsed time falls after refDT
//   (e.g. LFA 2200Z with T/O 0500Z next morning).
// direction 'after': step forward one day if parsed time falls before refDT
//   (e.g. Land 0200Z with T/O 2300Z).
// For Zulu input the day roll is applied in UTC to avoid DST offset shifts
// on transition boundaries.
export function resolveTime(DateTime, timeStr, inputTimezone, timezone, refDT, direction) {
  const dt = parseTime(DateTime, timeStr, inputTimezone, timezone, refDT);
  if (!dt || !refDT) return dt;
  if (direction === 'before' && dt > refDT) {
    return inputTimezone === 'Z'
      ? dt.toUTC().minus({ days: 1 }).setZone(timezone)
      : dt.minus({ days: 1 });
  }
  if (direction === 'after' && dt < refDT) {
    return inputTimezone === 'Z'
      ? dt.toUTC().plus({ days: 1 }).setZone(timezone)
      : dt.plus({ days: 1 });
  }
  return dt;
}

export function calculateMissionTimes(DateTime, config) {
  const {
    alertType,
    season,
    formationType,
    crewType,
    timezone,
    inputTimezone,
    takeoffTime,
    landTime,
    lfaTime,
    briefMinutes = 30,
    briefReference = 'After Show'
  } = config;

  if (alertType === 'LFA' && !lfaTime && !takeoffTime) return null;
  if (alertType === 'Self Alert' && !takeoffTime) return null;

  const results = [];
  const warnings = [];
  const intervals = getIntervals(season, formationType);

  let lfaLocal = null;
  let toLocal = null;
  let duration = null;

  // T/O is the master anchor; all other times are resolved relative to it.
  if (takeoffTime) {
    toLocal = parseTime(DateTime, takeoffTime, inputTimezone, timezone, null);
    if (!toLocal) return null;
  }

  // LFA must precede T/O; step back one day when the entered time is numerically
  // after T/O (e.g. LFA 2200Z, T/O 0500Z next morning).
  if (lfaTime) {
    lfaLocal = resolveTime(DateTime, lfaTime, inputTimezone, timezone, toLocal, 'before');
    if (!lfaLocal) return null;
  }

  let alertLocal = null;

  if (alertType === 'LFA') {
    if (lfaLocal && toLocal) {
      // Case C: both provided — Alert = T/O minus required interval; warn if tight.
      const calculatedAlert = toLocal.minus(intervals.lfaToTO);
      alertLocal = calculatedAlert;
      if (calculatedAlert < lfaLocal) {
        const minRequired = formatDuration(intervals.lfaToTO.hours * 60 + intervals.lfaToTO.minutes);
        warnings.push({ text: 'Alert to T/O less than ' + minRequired, severity: 'error' });
      }
    } else if (!lfaLocal && toLocal) {
      // Case B: T/O only — LFA = Alert = T/O minus required interval.
      lfaLocal = toLocal.minus(intervals.lfaToTO);
      alertLocal = lfaLocal;
    } else if (lfaLocal && !toLocal) {
      // Case A: LFA only — Alert = LFA, T/O = LFA plus required interval.
      toLocal = lfaLocal.plus(intervals.lfaToTO);
      alertLocal = lfaLocal;
    }
  }

  // In Case C tight, crew cannot be alerted before LFA; use LFA as effective alert.
  const effectiveAlertLocal = (alertLocal && lfaLocal && alertLocal < lfaLocal)
    ? lfaLocal
    : alertLocal;

  let crewRestLocal;
  if (alertType === 'LFA' && effectiveAlertLocal) {
    crewRestLocal = effectiveAlertLocal
      .plus({ hours: REGS.fdpLfaBufferHours })
      .minus({ hours: REGS.crewRestHours });
  } else if (toLocal) {
    crewRestLocal = toLocal.minus(intervals.showToTO).minus({ hours: REGS.crewRestHours });
  }

  if (lfaLocal && crewRestLocal && crewRestLocal > lfaLocal) {
    crewRestLocal = lfaLocal;
  }

  if (crewRestLocal) results.push({ event: 'Crew Rest', local: crewRestLocal });
  if (alertType === 'LFA' && lfaLocal)  results.push({ event: 'LFA',   local: lfaLocal });
  if (alertType === 'LFA' && alertLocal) results.push({ event: 'Alert', local: alertLocal });

  if (toLocal) {
    const showLocal  = toLocal.minus(intervals.showToTO);
    const stepLocal  = toLocal.minus(intervals.stepToTO);
    const startLocal = toLocal.minus(intervals.startToTO);
    const checkInLocal = formationType === 'Formation'
      ? startLocal.minus({ minutes: REGS.checkInBeforeStartMin })
      : null;

    const showMinToTO = intervals.showToTO.hours * 60 + intervals.showToTO.minutes;
    const stepMinToTO = intervals.stepToTO.hours * 60 + intervals.stepToTO.minutes;
    const briefMinToTO = briefReference === 'After Show'
      ? showMinToTO - briefMinutes
      : stepMinToTO + briefMinutes;

    if (briefMinToTO <= stepMinToTO) {
      warnings.push({ text: 'Brief falls at or after Step — adjust Crew Brief in Setup', severity: 'caution' });
    } else if (briefMinToTO >= showMinToTO) {
      warnings.push({ text: 'Brief falls at or before Show — adjust Crew Brief in Setup', severity: 'caution' });
    }

    const briefLocal = toLocal.minus({ minutes: briefMinToTO });

    if (formationType === 'Formation' && checkInLocal) {
      results.push({ event: 'Check In', local: checkInLocal });
    }

    results.push(
      { event: 'Show',  local: showLocal },
      { event: 'Brief', local: briefLocal },
      { event: 'Step',  local: stepLocal },
      { event: 'Start', local: startLocal },
      { event: 'T/O',   local: toLocal }
    );

    if (landTime) {
      // Land must follow T/O; step forward one day when entered time is numerically
      // before T/O (e.g. Land 0200Z, T/O 2300Z).
      const landRaw   = parseTime(DateTime, landTime, inputTimezone, timezone, toLocal);
      const landLocal = resolveTime(DateTime, landTime, inputTimezone, timezone, toLocal, 'after');
      if (landRaw && landLocal && landRaw < toLocal) {
        warnings.push({ text: 'Land time interpreted as next day', severity: 'caution' });
      }
      if (landLocal) {
        results.push({ event: 'Land', local: landLocal });
        duration = formatDuration(landLocal.diff(toLocal, 'minutes').minutes);
      }
    }

    const fdpHours = crewType === 'Basic Crew' ? REGS.fdpBasicHours : REGS.fdpAugmentedHours;
    const fdpStartLocal = (alertType === 'LFA' && effectiveAlertLocal)
      ? effectiveAlertLocal.plus({ hours: REGS.fdpLfaBufferHours })
      : showLocal;
    results.push({ event: 'FDP End', local: fdpStartLocal.plus({ hours: fdpHours }) });
  }

  // Mark rows that fall before LFA as out-of-order (Case C tight interval only).
  if (alertType === 'LFA' && lfaLocal && alertLocal && alertLocal < lfaLocal) {
    results.forEach(r => {
      if (r.event !== 'Crew Rest' && r.event !== 'LFA' && r.local < lfaLocal) r.outOfOrder = true;
    });
  }

  results.sort((a, b) => a.local.toMillis() - b.local.toMillis());

  // Annotate each result with calendar-day offsets relative to T/O.
  // localDayOffset: days from T/O's local calendar day (e.g. -1 = night before T/O).
  // zuluDayOffset:  days from T/O's UTC calendar day.
  // Used by the UI to append "+N"/"-N" so multi-day timelines are unambiguous.
  const toLocalDay = toLocal.startOf('day');
  const toZuluDay  = toLocal.toUTC().startOf('day');
  results.forEach(r => {
    r.localDayOffset = Math.round(r.local.startOf('day').diff(toLocalDay, 'days').days);
    r.zuluDayOffset  = Math.round(r.local.toUTC().startOf('day').diff(toZuluDay, 'days').days);
  });

  return { results, warnings, duration };
}
