import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { computeElapsedMinutes } from './elapsed';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function flush(learningPlanId: string, startedAtMs: number) {
  const minutes = computeElapsedMinutes(startedAtMs, Date.now());
  if (minutes <= 0) return;
  await supabase.rpc('increment_actual_minutes', {
    p_learning_plan_id: learningPlanId,
    p_log_date: todayIsoDate(),
    p_minutes: minutes,
  });
}

/** Call once per learning screen (Vocab/Grammar/Listening). Tracks active time and flushes it to
 * plan_day_logs.actual_minutes via increment_actual_minutes() on unmount or app backgrounding. */
export function useStudyTimer(learningPlanId: string): void {
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        flush(learningPlanId, startedAtRef.current);
        startedAtRef.current = Date.now();
      }
    });

    return () => {
      flush(learningPlanId, startedAtRef.current);
      subscription.remove();
    };
  }, [learningPlanId]);
}
