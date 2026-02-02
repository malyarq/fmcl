import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

interface Particle {
  id: string;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  size: number;
}

// Main screen for Classic mode (legacy): логотип лаунчера с иконкой.
export const SimplePlayHome: React.FC = () => {
  const { getAccentStyles, getAccentHex } = useSettings();
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const clickTimestampsRef = useRef<number[]>([]);
  const easterEggTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const particleIdCounterRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const lastFireworksTimeRef = useRef<number>(0);

  const accent = getAccentStyles('text');
  const accentHex = getAccentHex();

  const generateParticles = (baseId: number): Particle[] => {
    const count = 15; // Уменьшил количество частиц для производительности
    const particles: Particle[] = [];
    
    for (let i = 0; i < count; i++) {
      particles.push({
        id: `particle-${baseId}-${i}`,
        angle: (360 / count) * i + Math.random() * 20 - 10, // Равномерное распределение с небольшим разбросом
        distance: 150 + Math.random() * 100, // Расстояние разлета
        duration: 1.2 + Math.random() * 0.3, // Уменьшил длительность
        delay: Math.random() * 0.2, // Уменьшил задержку
        size: 16 + Math.random() * 10, // Размер иконки
      });
    }
    
    return particles;
  };

  const launchFireworks = () => {
    const waveId = particleIdCounterRef.current++;
    const newParticles = generateParticles(waveId);
    
    // Ограничиваем общее количество частиц (максимум 60)
    setParticles((prev) => {
      const combined = [...prev, ...newParticles];
      // Удаляем самые старые, если превышен лимит
      return combined.slice(-60);
    });
    
    // Удаляем старые частицы быстрее
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !p.id.startsWith(`particle-${waveId}-`)));
    }, 2000);
  };

  const handleLogoClick = () => {
    const now = Date.now();
    clickTimestampsRef.current.push(now);
    lastClickTimeRef.current = now;
    
    // Оставляем только клики за последние 2 секунды
    clickTimestampsRef.current = clickTimestampsRef.current.filter(
      (timestamp) => now - timestamp < 2000
    );

    const newCount = clickTimestampsRef.current.length;

    // Активируем первую фазу при 7+ кликах за 2 секунды
    if (newCount >= 7) {
      if (!showEasterEgg) {
        setShowEasterEgg(true);
        // Запускаем первый фейерверк через 0.8 секунды
        setTimeout(() => {
          launchFireworks();
        }, 800);
      } else {
        // Если пасхалка уже активна, запускаем новый фейерверк с throttling (не чаще раза в 200мс)
        const now = Date.now();
        if (now - lastFireworksTimeRef.current > 200) {
          lastFireworksTimeRef.current = now;
          launchFireworks();
        }
      }
      
      // Сбрасываем таймер отключения
      if (easterEggTimeoutRef.current) {
        clearTimeout(easterEggTimeoutRef.current);
      }
      // Отключаем пасхалку только если нет активности 2 секунды
      easterEggTimeoutRef.current = setTimeout(() => {
        const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
        if (timeSinceLastClick >= 2000) {
          setShowEasterEgg(false);
          setParticles([]);
          clickTimestampsRef.current = [];
        }
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (easterEggTimeoutRef.current) {
        clearTimeout(easterEggTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full w-full flex items-center justify-center px-6 text-center animate-fade-in-up relative overflow-hidden">
      <div className="flex flex-col items-center gap-4 relative z-10">
        <div
          onClick={handleLogoClick}
          className="logo-container relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-visible cursor-pointer transition-all duration-300 ease-out hover:scale-110 active:scale-105"
          style={{
            filter: `drop-shadow(0 0 20px ${accentHex}60) drop-shadow(0 0 40px ${accentHex}40)`,
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl animate-pulse-slow"
            style={{
              background: `radial-gradient(circle, ${accentHex}30 0%, transparent 70%)`,
              animation: showEasterEgg ? 'easter-egg-glow 0.5s ease-in-out infinite' : 'none',
            }}
          />
          <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-900/90 flex items-center justify-center backdrop-blur-sm">
            <img
              src="/icon.png"
              alt="FriendLauncher"
              className="w-16 h-16 md:w-20 md:h-20 object-contain transition-transform duration-300"
              style={{
                transform: showEasterEgg ? 'rotate(360deg) scale(1.2)' : 'none',
                filter: showEasterEgg ? `drop-shadow(0 0 15px ${accentHex})` : 'none',
              }}
            />
          </div>
        </div>

        <h1
          className={`text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm transition-all duration-300 ${accent.className ?? ''} ${showEasterEgg ? 'animate-pulse scale-110' : ''}`}
          style={{
            ...(accent.style ?? {}),
            textShadow: showEasterEgg
              ? `0 0 20px ${accentHex}, 0 0 40px ${accentHex}, 0 4px 14px ${accentHex}80`
              : `0 4px 14px ${accentHex}40`,
          }}
        >
          FriendLauncher
        </h1>
      </div>

      {/* Фейерверк из иконок */}
      {particles.map((particle) => {
        const angleRad = (particle.angle * Math.PI) / 180;
        const x = Math.cos(angleRad) * particle.distance;
        const y = Math.sin(angleRad) * particle.distance;
        const rotation = particle.angle + 360;
        
        return (
          <div
            key={particle.id}
            className="absolute pointer-events-none firework-particle"
            style={{
              left: '50%',
              top: '50%',
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              '--particle-x': `${x}px`,
              '--particle-y': `${y}px`,
              '--particle-rotation': `${rotation}deg`,
              '--particle-duration': `${particle.duration}s`,
              '--particle-delay': `${particle.delay}s`,
              '--accent-color': accentHex,
            } as React.CSSProperties & {
              '--particle-x': string;
              '--particle-y': string;
              '--particle-rotation': string;
              '--particle-duration': string;
              '--particle-delay': string;
              '--accent-color': string;
            }}
          >
            <img
              src="/icon.png"
              alt=""
              className="w-full h-full object-contain"
              style={{
                filter: `drop-shadow(0 0 6px ${accentHex}) drop-shadow(0 0 12px ${accentHex}60)`,
              }}
            />
          </div>
        );
      })}

      <style>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.05);
          }
        }

        @keyframes easter-egg-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        @keyframes firework-particle {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1);
            filter: drop-shadow(0 0 6px var(--accent-color)) drop-shadow(0 0 12px var(--accent-color));
          }
          50% {
            opacity: 0.8;
            transform: translate(-50%, -50%) translate(calc(var(--particle-x) * 0.5), calc(var(--particle-y) * 0.5)) rotate(calc(var(--particle-rotation) * 0.5)) scale(1.05);
            filter: drop-shadow(0 0 8px var(--accent-color)) drop-shadow(0 0 16px var(--accent-color));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--particle-x), var(--particle-y)) rotate(var(--particle-rotation)) scale(0.2);
            filter: drop-shadow(0 0 2px var(--accent-color)) drop-shadow(0 0 4px var(--accent-color));
          }
        }

        .firework-particle {
          animation: firework-particle var(--particle-duration) ease-out var(--particle-delay) forwards;
          will-change: transform, opacity;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .logo-container:hover {
          filter: drop-shadow(0 0 30px ${accentHex}80) drop-shadow(0 0 60px ${accentHex}60) !important;
        }
      `}</style>
    </div>
  );
};



