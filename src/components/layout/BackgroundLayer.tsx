import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import type { ISourceOptions } from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";
import { useSettings } from '../../contexts/SettingsContext';

export const BackgroundLayer = () => {
    const { customTheme, disableAnimations } = useSettings();
    const config = customTheme.background;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [init, setInit] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const reducedMotion = disableAnimations || prefersReducedMotion;
    const particleOptions = useMemo<ISourceOptions>(() => ({
        background: {
            color: {
                value: customTheme.colors?.background || "#000000",
            },
        },
        fpsLimit: 120,
        interactivity: {
            events: {
                onClick: {
                    enable: true,
                    mode: "push",
                },
                onHover: {
                    enable: true,
                    mode: "repulse",
                },
            },
            modes: {
                push: {
                    quantity: 4,
                },
                repulse: {
                    distance: 200,
                    duration: 0.4,
                },
            },
        },
        particles: {
            color: {
                value: "#ffffff",
            },
            links: {
                color: "#ffffff",
                distance: 150,
                enable: true,
                opacity: 0.5,
                width: 1,
            },
            move: {
                direction: config?.particles?.type === 'rain' ? "bottom" : "none",
                enable: true,
                outModes: {
                    default: "out",
                },
                random: false,
                speed: config?.particles?.speed || 2,
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                    area: 800,
                },
                value: (config?.particles?.intensity || 50) * 1.5,
            },
            opacity: {
                value: 0.5,
            },
            shape: {
                type: config?.particles?.type === 'stars' ? "star" : "circle",
            },
            size: {
                value: { min: 1, max: 5 },
            },
        },
        detectRetina: true,
    }), [customTheme.colors?.background, config?.particles]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updatePreference = () => {
            setPrefersReducedMotion(mediaQuery.matches);
        };

        updatePreference();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updatePreference);
        } else {
            mediaQuery.addListener(updatePreference);
        }

        return () => {
            if (typeof mediaQuery.removeEventListener === 'function') {
                mediaQuery.removeEventListener('change', updatePreference);
            } else {
                mediaQuery.removeListener(updatePreference);
            }
        };
    }, []);

    useEffect(() => {
        if (config?.type !== 'particles' || reducedMotion) {
            return;
        }

        let isActive = true;

        initParticlesEngine(async (engine) => {
            await loadSlim(engine);
        }).then(() => {
            if (isActive) {
                setInit(true);
            }
        });
        return () => {
            isActive = false;
        };
    }, [config?.type, reducedMotion]);

    // Video Auto-Pause Logic
    useEffect(() => {
        if (config?.type !== 'video' || reducedMotion || !config.video?.autoPause || !videoRef.current) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                videoRef.current?.pause();
            } else {
                videoRef.current?.play().catch(() => { });
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [config?.type, config?.video?.autoPause, reducedMotion]);

    // Handle volume changes
    useEffect(() => {
        if (videoRef.current && config?.video?.volume !== undefined) {
            videoRef.current.volume = config.video.volume;
        }
    }, [config?.video?.volume]);


    if (!config) return null;

    const style: React.CSSProperties = {};
    const renderStaticBackdrop = (imageLayerStyle?: React.CSSProperties) => (
        <div
            className="fixed inset-0 -z-10 overflow-hidden bg-background pointer-events-none"
            aria-hidden="true"
            data-testid="background-static-fallback"
        >
            {imageLayerStyle && (
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={imageLayerStyle}
                />
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--accent-main),0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(var(--accent-main),0.08),transparent_36%)]" />
            <div className="absolute inset-0 bg-background/40" />
        </div>
    );

    if (config.type === 'video' && config.video?.url) {
        if (reducedMotion) {
            return renderStaticBackdrop();
        }

        return (
            <div className="fixed inset-0 -z-10 overflow-hidden bg-background" aria-hidden="true">
                <video
                    ref={videoRef}
                    src={config.video.url}
                    autoPlay
                    loop={config.video.loop ?? true}
                    muted={config.video.volume === 0}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ opacity: config.opacity ?? 1, filter: `blur(${config.blur || 0}px)` }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--accent-main),0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(var(--accent-main),0.08),transparent_36%)]" />
                <div className="absolute inset-0 bg-background/56" />
            </div>
        );
    }

    if (config.type === 'particles') {
        if (reducedMotion || !init) {
            return renderStaticBackdrop();
        }

        return (
            <div className="fixed inset-0 -z-10 bg-background" aria-hidden="true">
                <Particles
                    id="tsparticles"
                    options={particleOptions}
                    className="absolute inset-0"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--accent-main),0.14),transparent_44%),radial-gradient(circle_at_bottom_left,rgba(var(--accent-main),0.08),transparent_38%)]" />
                <div className="absolute inset-0 bg-background/30" />
            </div>
        );
    }

    // Fallback to Image
    if (config.image) {
        style.backgroundImage = `url(${config.image})`;
    }

    if (config.position) {
        if (config.position === 'cover') {
            style.backgroundSize = 'cover';
            style.backgroundRepeat = 'no-repeat';
            style.backgroundPosition = 'center';
        } else if (config.position === 'contain') {
            style.backgroundSize = 'contain';
            style.backgroundRepeat = 'no-repeat';
            style.backgroundPosition = 'center';
        } else if (config.position === 'center') {
            style.backgroundPosition = 'center';
            style.backgroundRepeat = 'no-repeat';
        } else if (config.position === 'repeat') {
            style.backgroundRepeat = 'repeat';
        }
    } else {
        // Default legacy behavior
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
    }

    if (config.blur) {
        style.filter = `blur(${config.blur}px)`;
    }
    if (config.opacity !== undefined) {
        style.opacity = config.opacity;
    }

    return renderStaticBackdrop(style);
};
