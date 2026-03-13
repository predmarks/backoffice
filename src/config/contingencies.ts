export const CONTINGENCY_TEMPLATES = {
  lagged_data_period: (metric: string, period: string, source: string) =>
    `La resolución se basará en el valor de ${metric} correspondiente a ${period}, según lo publique ${source}. Este dato se publica habitualmente con un rezago de varios días hábiles posteriores al cierre del mercado.`,

  source_unavailable: (primary: string, alternative?: string) =>
    alternative
      ? `Si ${primary} no publica los datos en tiempo y forma, se utilizará ${alternative} como fuente alternativa, o el último dato publicado disponible.`
      : `Si ${primary} no publica los datos en tiempo y forma, se utilizará el último dato publicado disponible.`,

  holiday_fallback: (source: string) =>
    `Si la fecha de resolución cae en feriado o día no hábil y ${source} no publica, se utiliza el dato correspondiente al último día hábil del período.`,

  sports_rescheduling: (match: string) =>
    `Si ${match} se reprograma a una fecha anterior a la prevista, el mercado se cerrará anticipadamente antes del inicio del partido y se resolverá según el resultado en la nueva fecha. Si se posterga a una fecha posterior al cierre del mercado, o se cancela o suspende, se resolverá como "No". Un cambio de horario dentro del mismo día no afecta al mercado. Predmarks se reserva el derecho de modificar la fecha de cierre del mercado ante cambios en la programación del evento.`,

  regulation_time_only: () =>
    `Se considera únicamente el resultado en tiempo reglamentario (90 minutos más tiempo adicionado).`,

  event_cancelled: (event: string) =>
    `Si ${event} se cancela o pospone indefinidamente, el mercado se resolverá como "No".`,

  event_postponed: (event: string) =>
    `Si ${event} se pospone pero se reprograma dentro del período del mercado, se utilizará el resultado de la fecha reprogramada.`,

  event_rescheduled_earlier: (event: string) =>
    `Si ${event} se reprograma a una fecha anterior, el mercado se cerrará anticipadamente y se resolverá según el resultado. Predmarks se reserva el derecho de modificar la fecha de cierre del mercado ante cambios en la programación del evento.`,

  data_revision: () =>
    `En caso de revisión posterior de los datos, se utilizará el dato publicado originalmente (primera publicación).`,
};
