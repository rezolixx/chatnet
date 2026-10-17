export function GamesLoading({ label }: { label: string }) {
  return <section className="section rankings-section" aria-busy="true"><div className="container"><p className="sr-only" role="status">{label}</p><div className="games-skeleton" aria-hidden="true"><span className="games-skeleton-title" />{Array.from({ length: 6 }, (_, index) => <span className="games-skeleton-row" key={index} />)}</div></div></section>;
}
