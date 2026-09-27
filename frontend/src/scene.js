// scene.js — rules for the three dilemma types (see ADMIN_BUILDER.md).
// For each outcome, where its at-risk group is:
//   'ahead' = pedestrians on the crossing in the car's own lane
//   'other' = pedestrians on the crossing in the other lane
//   'car'   = passengers (the car hits a barrier)

export const DILEMMAS = {
  peds_vs_peds: {
    label: 'Pedestrians vs. pedestrians',
    stay: 'ahead',
    swerve: 'other',
  },
  peds_ahead_vs_car: {
    label: 'Pedestrians ahead vs. passengers',
    stay: 'ahead',
    swerve: 'car', // barrier in the other lane
  },
  car_vs_peds_other: {
    label: 'Passengers vs. pedestrians other lane',
    stay: 'car', // barrier ahead
    swerve: 'other',
  },
}

// Caption for where a group is.
export const PLACE_CAPTIONS = {
  ahead: 'Crossing ahead',
  other: 'Crossing in other lane',
  car: 'In the car',
}

// Which lane (if any) has the barrier: the lane the car drives into when passengers are the ones at risk.
export function barrierLane(dilemma) {
  const d = DILEMMAS[dilemma]
  if (d.stay === 'car') return 'ahead'
  if (d.swerve === 'car') return 'other'
  return null
}

// Lanes that have pedestrians (only these can have a road light).
export function pedestrianLanes(dilemma) {
  const d = DILEMMAS[dilemma]
  return [d.stay, d.swerve].filter((place) => place !== 'car')
}
