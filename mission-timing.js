export const formatDuration = (totalMin) => {
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h + '+' + String(m).padStart(2, '0');
};

export function getIntervals(season, formationType) {
  const isSummer = season === 'Summer';
  const isSingleShip = formationType === 'Single Ship';
  return {
    lfaToTO: isSummer ? { hours: 4, minutes: 15 } : { hours: 4, minutes: 45 },
    showToTO: isSummer ? { hours: 3, minutes: 15 } : { hours: 3, minutes: 45 },
    stepToTO: isSingleShip && isSummer ? { hours: 1, minutes: 45 } : { hours: 2, minutes: 0 },
    startToTO: isSummer ? { hours: 0, minutes: 25 } : { hours: 0, minutes: 30 }
  };
}

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

  if (takeoffTime) {
    toLocal = parseTime(DateTime, takeoffTime, inputTimezone, timezone, null);
    if (!toLocal) return null;
  }

  if (lfaTime) {
    lfaLocal = resolveTime(DateTime, lfaTime, inputTimezone, timezone, toLocal, 'before');
    if (!lfaLocal) return null;
  }

  let alertLocal = null;

  if (alertType === 'LFA') {
    if (lfaLocal && toLocal) {
      const calculatedAlert = toLocal.minus(intervals.lfaToTO);
      alertLocal = calculatedAlert;
      if (calculatedAlert < lfaLocal) {
        const minRequired = formatDuration(intervals.lfaToTO.hours * 60 + intervals.lfaToTO.minutes);
        warnings.push({ text: 'Alert to T/O less than ' + minRequired, severity: 'error' });
      }
    } else if (!lfaLocal && toLocal) {
      lfaLocal = toLocal.minus(intervals.lfaToTO);
      alertLocal = lfaLocal;
    } else if (lfaLocal && !toLocal) {
      toLocal = lfaLocal.plus(intervals.lfaToTO);
      alertLocal = lfaLocal;
    }
  }

  const effectiveAlertLocal = (alertLocal && lfaLocal && alertLocal < lfaLocal)
    ? lfaLocal
    : alertLocal;

  let crewRestLocal;
  if (alertType === 'LFA' && effectiveAlertLocal) {
    crewRestLocal = effectiveAlertLocal.plus({ hours: 1 }).minus({ hours: 12 });
  } else if (toLocal) {
    const showLocal = toLocal.minus(intervals.showToTO);
    crewRestLocal = showLocal.minus({ hours: 12 });
  }

  if (crewRestLocal) results.push({ event: 'Crew Rest', local: crewRestLocal });
  if (alertType === 'LFA' && lfaLocal) results.push({ event: 'LFA', local: lfaLocal });
  if (alertType === 'LFA' && alertLocal) results.push({ event: 'Alert', local: alertLocal });

  if (toLocal) {
    const showLocal = toLocal.minus(intervals.showToTO);
    const stepLocal = toLocal.minus(intervals.stepToTO);
    const startLocal = toLocal.minus(intervals.startToTO);
    const checkInLocal = formationType === 'Formation' ? startLocal.minus({ minutes: 5 }) : null;

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
      { event: 'Show', local: showLocal },
      { event: 'Brief', local: briefLocal },
      { event: 'Step', local: stepLocal },
      { event: 'Start', local: startLocal },
      { event: 'T/O', local: toLocal }
    );

    if (landTime) {
      const landRaw = parseTime(DateTime, landTime, inputTimezone, timezone, toLocal);
      const landLocal = resolveTime(DateTime, landTime, inputTimezone, timezone, toLocal, 'after');
      if (landRaw && landLocal && landRaw < toLocal) {
        warnings.push({ text: 'Land time interpreted as next day', severity: 'caution' });
      }
      if (landLocal) {
        results.push({ event: 'Land', local: landLocal });
        duration = formatDuration(landLocal.diff(toLocal, 'minutes').minutes);
      }
    }

    const fdpHours = crewType === 'Basic Crew' ? 16 : 24;
    const fdpStartLocal = (alertType === 'LFA' && effectiveAlertLocal)
      ? effectiveAlertLocal.plus({ hours: 1 })
      : showLocal;
    const fdpEndLocal = fdpStartLocal.plus({ hours: fdpHours });
    results.push({ event: 'FDP End', local: fdpEndLocal });
  }

  if (alertType === 'LFA' && lfaLocal && alertLocal && alertLocal < lfaLocal) {
    results.forEach((r) => {
      if (r.event !== 'Crew Rest' && r.event !== 'LFA' && r.local < lfaLocal) r.outOfOrder = true;
    });
  }

  results.sort((a, b) => a.local.toMillis() - b.local.toMillis());
  return { results, warnings, duration };
}
