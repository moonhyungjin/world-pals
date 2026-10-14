const COLORS = ['#f4a24a', '#ef6f8f', '#4f8df5', '#4cc38a', '#f7d046', '#a67cf0'];
const COUNT = 36;

/** 위에서 떨어지는 색종이. 위치/색/속도는 번호로 정해서 항상 같다(테스트하기 쉽고 계산이 없다). 장식이라 화면 낭독기에는 숨긴다. */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${((i * 13) % 10) * 0.12}s`,
            animationDuration: `${2.4 + ((i * 7) % 5) * 0.3}s`,
            ['--sway' as string]: `${((i % 5) - 2) * 18}px`,
            borderRadius: i % 3 === 0 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}
