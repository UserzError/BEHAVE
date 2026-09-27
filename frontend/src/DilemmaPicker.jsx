// DilemmaPicker — three cards for the dilemma type. Each has a tiny icon of the setup:
// left lane = other lane, right lane = the car's lane; person = pedestrians, gray block = barrier.
import { DILEMMAS, barrierLane } from './scene.js'

const LANE_X = { other: 18, ahead: 46 } // lane centers in the icon

function Person({ x }) {
  return (
    <g>
      <circle cx={x} cy="8" r="3.2" style={{ fill: 'var(--char-teal-light)' }} />
      <rect x={x - 3} y="11.5" width="6" height="9" rx="3" style={{ fill: 'var(--char-teal)' }} />
    </g>
  )
}

function DilemmaIcon({ dilemma }) {
  const d = DILEMMAS[dilemma]
  const barrier = barrierLane(dilemma)
  const passengersAtRisk = d.stay === 'car' || d.swerve === 'car'
  return (
    <svg viewBox="0 0 64 48" className="dilemma-icon" aria-hidden="true">
      <rect x="4" width="56" height="48" rx="5" style={{ fill: 'var(--road)' }} />
      <path d="M32 0 V48" style={{ stroke: 'var(--road-line)', strokeWidth: 1.5, strokeDasharray: '4 3' }} />
      {['other', 'ahead'].map((lane) => {
        if (lane === barrier) {
          return <rect key={lane} x={LANE_X[lane] - 10} y="10" width="20" height="8" rx="1.5" style={{ fill: 'var(--concrete)' }} />
        }
        return d.stay === lane || d.swerve === lane
          ? <g key={lane}><Person x={LANE_X[lane] - 4} /><Person x={LANE_X[lane] + 4} /></g>
          : null
      })}
      {/* the car, with passengers shown when they're the ones at risk */}
      <rect x={LANE_X.ahead - 7} y="28" width="14" height="18" rx="2.5" style={{ fill: 'var(--scene-car)' }} />
      {passengersAtRisk && <circle cx={LANE_X.ahead} cy="38" r="3" style={{ fill: 'var(--char-teal-light)' }} />}
    </svg>
  )
}

export default function DilemmaPicker({ value, onChange }) {
  return (
    <fieldset className="dilemma-picker">
      <legend>Dilemma type</legend>
      <div className="dilemma-cards">
        {Object.entries(DILEMMAS).map(([id, d]) => (
          <button
            key={id}
            type="button"
            className="dilemma-card"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            <DilemmaIcon dilemma={id} />
            <span>{d.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
