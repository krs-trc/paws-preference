import { useState, useEffect, useRef } from "react";
import "./App.css";

const CAT_TAGS = [
  "cute", "fluffy", "kitten", "orange", "tabby", "black",
  "white", "sleeping", "playing", "tiny"
];

function generateCats() {
  return CAT_TAGS.map((tag, i) => ({
    id: i,
    url: `https://cataas.com/cat/${tag}?width=600&v=${Math.random()}`,
    tag,
    blobUrl: null,
  }));
}

const SWIPE_THRESHOLD = 80;

function HeartParticle({ x, y, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="heart-particle" style={{ left: x, top: y }}>
      💕
    </div>
  );
}

function preloadAsBlob(url) {
  return fetch(url, { mode: "cors" })
    .then(r => r.blob())
    .then(blob => URL.createObjectURL(blob))
    .catch(() => url);
}

export default function App() {
  const [cards, setCards] = useState(generateCats);
  const [liked, setLiked] = useState([]);
  const [disliked, setDisliked] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(CAT_TAGS.length - 1);
  const [dragState, setDragState] = useState({ dragging: false, dx: 0, dy: 0, startX: 0, startY: 0 });
  const [phase, setPhase] = useState("swiping");
  const [hearts, setHearts] = useState([]);
  const [flyDir, setFlyDir] = useState(null);
  const [loading, setLoading] = useState(true);

  const preloadedRef = useRef(new Set());

  const preloadCard = (index, cardsArr) => {
    if (index < 0 || index >= cardsArr.length) return;
    if (preloadedRef.current.has(index)) return;
    preloadedRef.current.add(index);

    preloadAsBlob(cardsArr[index].url).then(blobUrl => {
      setCards(prev =>
        prev.map((c, i) => i === index ? { ...c, blobUrl } : c)
      );
    });
  };

  useEffect(() => {
    const initialCards = cards;

    const topThree = [currentIndex, currentIndex - 1, currentIndex - 2].filter(i => i >= 0);
    let done = 0;

    topThree.forEach(idx => {
      preloadedRef.current.add(idx);
      preloadAsBlob(initialCards[idx].url).then(blobUrl => {
        setCards(prev =>
          prev.map((c, i) => i === idx ? { ...c, blobUrl } : c)
        );
        done++;
        if (done === 1) setLoading(false);
      });
    });

    const rest = initialCards
      .map((_, i) => i)
      .filter(i => !topThree.includes(i));

    const timer = setTimeout(() => {
      rest.forEach(idx => preloadCard(idx, initialCards));
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    preloadCard(currentIndex - 1, cards);
    preloadCard(currentIndex - 2, cards);
  }, [currentIndex]);

  function addHeart() {
    const id = Date.now() + Math.random();
    setHearts(h => [...h, { id, x: window.innerWidth / 2 - 16, y: window.innerHeight / 2 - 80 }]);
  }

  function removeHeart(id) {
    setHearts(h => h.filter(p => p.id !== id));
  }

  function finishSwipe(dir) {
    if (currentIndex < 0) return;
    const card = cards[currentIndex];
    if (dir === "right") {
      setLiked(l => [...l, card]);
      addHeart();
    } else {
      setDisliked(d => [...d, card]);
    }
    setFlyDir(dir);
    setDragState({ dragging: false, dx: 0, dy: 0, startX: 0, startY: 0 });
    setTimeout(() => {
      setFlyDir(null);
      setCurrentIndex(i => {
        const next = i - 1;
        if (next < 0) setPhase("summary");
        return next;
      });
    }, 400);
  }

  function onPointerDown(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragState({ dragging: true, dx: 0, dy: 0, startX: clientX, startY: clientY });
  }

  function onPointerMove(e) {
    if (!dragState.dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragState(d => ({ ...d, dx: clientX - d.startX, dy: clientY - d.startY }));
  }

  function onPointerUp() {
    if (!dragState.dragging) return;
    const { dx } = dragState;
    if (dx > SWIPE_THRESHOLD) finishSwipe("right");
    else if (dx < -SWIPE_THRESHOLD) finishSwipe("left");
    else setDragState({ dragging: false, dx: 0, dy: 0, startX: 0, startY: 0 });
  }

  function handleRestart() {
    setLoading(true);
    setLiked([]);
    setDisliked([]);
    setHearts([]);
    preloadedRef.current = new Set();
    const newCards = generateCats();
    setCards(newCards);
    setCurrentIndex(CAT_TAGS.length - 1);
    setPhase("swiping");
    setFlyDir(null);
    setDragState({ dragging: false, dx: 0, dy: 0, startX: 0, startY: 0 });

    const topThree = [newCards.length - 1, newCards.length - 2, newCards.length - 3].filter(i => i >= 0);
    let done = 0;
    topThree.forEach(idx => {
      preloadedRef.current.add(idx);
      preloadAsBlob(newCards[idx].url).then(blobUrl => {
        setCards(prev =>
          prev.map((c, i) => i === idx ? { ...c, blobUrl } : c)
        );
        done++;
        if (done === 1) setLoading(false);
      });
    });
    setTimeout(() => {
      newCards.forEach((_, idx) => {
        if (!preloadedRef.current.has(idx)) preloadCard(idx, newCards);
      });
    }, 800);
  }

  const rotation = dragState.dragging ? dragState.dx * 0.08 : 0;
  const likeOpacity = Math.min(Math.max(dragState.dx / SWIPE_THRESHOLD, 0), 1);
  const nopeOpacity = Math.min(Math.max(-dragState.dx / SWIPE_THRESHOLD, 0), 1);

  const flyX = flyDir === "right" ? window.innerWidth + 300 : flyDir === "left" ? -(window.innerWidth + 300) : 0;

  const topCard = cards[currentIndex];

  const summaryEmoji = liked.length === 0 ? "😿" : liked.length >= 8 ? "🥰" : liked.length >= 4 ? "😻" : "😊";

  return (
    <div className="app">
      {/* Background blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* Heart particles */}
      {hearts.map(h => (
        <HeartParticle key={h.id} x={h.x} y={h.y} onDone={() => removeHeart(h.id)} />
      ))}

      {/* Header */}
      <header className="header">
        <h1 className="logo">🐾 Paws &amp; Preferences</h1>
        <p className="tagline">Find your purr-fect Feline</p>
      </header>

      {loading && (
        <div className="loading-overlay">
          <div className="loader-content">
            <div className="cat-spinner">🐱</div>
            <p>Herding kitties...</p>
            <div className="progress-bar-wrap">
              <div className="progress-bar-fill"></div>
            </div>
          </div>
        </div>
      )}

      {phase === "swiping" ? (
        <>
          {/* Progress dots */}
          <div className="progress-dots">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`dot ${i === currentIndex ? "dot-active" : i > currentIndex ? "dot-done" : "dot-pending"}`}
              />
            ))}
          </div>

          {/* Card stack */}
          <div className="card-stack">
            {/* Background peek cards */}
            {[currentIndex - 1, currentIndex - 2].map((idx, layer) =>
              idx >= 0 ? (
                <div
                  key={cards[idx].id}
                  className="card card-bg"
                  style={{ zIndex: -layer - 1, transform: `scale(${0.92 - layer * 0.04}) translateY(${(layer + 1) * -14}px)` }}
                >
                  <img src={cards[idx].blobUrl || cards[idx].url} alt="cat" className="card-img card-img-muted" />
                </div>
              ) : null
            )}

            {/* Top card */}
            {currentIndex >= 0 && topCard && (
              <div
                className={`card card-top ${dragState.dragging ? "dragging" : ""}`}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                style={{
                  transform: flyDir
                    ? `translateX(${flyX}px) rotate(${flyDir === "right" ? 25 : -25}deg)`
                    : dragState.dragging
                      ? `translateX(${dragState.dx}px) translateY(${dragState.dy * 0.3}px) rotate(${rotation}deg)`
                      : "none",
                  transition: flyDir
                    ? "transform 0.4s cubic-bezier(0.5,0,1,0.5)"
                    : dragState.dragging
                      ? "none"
                      : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <div className="badge badge-like" style={{ opacity: likeOpacity }}>LIKE 💕</div>
                <div className="badge badge-nope" style={{ opacity: nopeOpacity }}>NOPE 👋</div>

                <img
                  src={topCard.blobUrl || topCard.url}
                  alt="cat"
                  className="card-img"
                  draggable={false}
                />

                <div className="card-label">
                  <div className="card-tag">#{topCard.tag} kitty 🐱</div>
                  <div className="card-count">{currentIndex + 1} of {cards.length} cats remaining</div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="actions">
            <button className="btn-action btn-nope" onClick={() => finishSwipe("left")} aria-label="Dislike">
              👋
            </button>
            <div className="actions-hint">swipe or tap</div>
            <button className="btn-action btn-like" onClick={() => finishSwipe("right")} aria-label="Like">
              💕
            </button>
          </div>
        </>
      ) : (
        /* Summary screen */
        <div className="summary">
          <div className="summary-card">
            <div className="summary-emoji">{summaryEmoji}</div>
            <h2 className="summary-title">
              You liked {liked.length} {liked.length === 1 ? "kitty" : "kitties"}!
            </h2>
            <p className="summary-sub">out of {cards.length} adorable cats 🐾</p>
            <div className="summary-pills">
              <span className="pill pill-like">💕 {liked.length} liked</span>
              <span className="pill pill-nope">👋 {disliked.length} passed</span>
            </div>
          </div>

          {liked.length > 0 && (
            <>
              <h3 className="liked-title">Your favourite kitties 😻</h3>
              <div className="liked-grid">
                {liked.map((cat, i) => (
                  <div key={cat.id} className="liked-item" style={{ animationDelay: `${i * 0.07}s` }}>
                    <img src={cat.blobUrl || cat.url} alt={cat.tag} className="liked-img" />
                    <div className="liked-tag">#{cat.tag}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {liked.length === 0 && (
            <div className="no-likes">
              <div className="no-likes-emoji">😿</div>
              <p>No cats liked this time... maybe try again?</p>
            </div>
          )}

          <button className="btn-restart" onClick={handleRestart}>
            🐾 Meet More Kitties!
          </button>
        </div>
      )}
    </div>
  );
}