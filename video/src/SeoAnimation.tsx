import React, {useMemo} from 'react';
import type {CSSProperties} from 'react';
import {
	AbsoluteFill,
	Easing,
	Sequence,
	continueRender,
	delayRender,
	interpolate,
	interpolateColors,
	random,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

/* ------------------------------------------------------------------ */
/* Composition constants                                               */
/* ------------------------------------------------------------------ */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_IN_FRAMES = 15 * FPS; // 450

// Scenes overlap by XFADE frames so every cut is a cross-dissolve.
const XFADE = 12;
const SCENES = {
	problem: {from: 0, duration: 96},
	solution: {from: 84, duration: 102},
	ai: {from: 174, duration: 84},
	data: {from: 246, duration: 120},
	cta: {from: 354, duration: 96},
} as const;

// Brand values from public/styles.css and docs/brand-mark.md.
const C = {
	ink: '#11100f',
	panel: '#171614',
	paper: '#fbfaf6',
	muted: '#8f8a80',
	red: '#e2462f',
	amber: '#ff9f43',
	green: '#3ecf8e',
	line: 'rgba(251,250,246,0.10)',
};

const FONT = 'Archivo, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, "DejaVu Sans Mono", monospace';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export type SeoAnimationProps = {
	hook: string;
	hookAccent: string;
	hookSub: string;
	solution: string;
	solutionSub: string;
	solutionQuery: string;
	aiHeadline: string;
	aiPrompt: string;
	dataHeadline: string;
	phoneQuery: string;
	businessName: string;
	businessDomain: string;
	ctaHeadline: string;
	ctaAccent: string;
	ctaButton: string;
	url: string;
};

export const defaultSeoProps: SeoAnimationProps = {
	hook: 'Struggling to get found on Google?',
	hookAccent: 'Google?',
	hookSub: 'Your customers are searching. They are finding someone else.',
	solution: 'We get you found.',
	solutionSub: 'On Google, in Maps and in AI answers.',
	solutionQuery: 'hardwood floor installers',
	aiHeadline: 'And cited when buyers ask AI.',
	aiPrompt: 'Who should I hire to install hardwood floors?',
	dataHeadline: 'Found the moment they search.',
	phoneQuery: 'contractor near me',
	businessName: 'Your Business',
	businessDomain: 'yourbusiness.com',
	ctaHeadline: 'Get your free SEO & AI visibility audit today.',
	ctaAccent: 'audit',
	ctaButton: 'Claim your free audit',
	url: 'burnworthco.com',
};

/* ------------------------------------------------------------------ */
/* Font: the same Archivo file the site ships, loaded from public/.    */
/* If the file is missing, rendering continues on the fallback stack.  */
/* ------------------------------------------------------------------ */

if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
	const handle = delayRender('Loading Archivo');
	const face = new FontFace(
		'Archivo',
		`url(${staticFile('archivo-latin.woff2')}) format('woff2')`,
		{weight: '400 700'},
	);
	face
		.load()
		.then(() => {
			document.fonts.add(face);
			continueRender(handle);
		})
		.catch(() => continueRender(handle));
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

// Catmull-Rom through the points, emitted as cubic beziers.
const smoothPath = (pts: Pt[]): string => {
	let d = `M ${pts[0][0]} ${pts[0][1]}`;
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[i - 1] ?? pts[i];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[i + 2] ?? p2;
		const c1x = p1[0] + (p2[0] - p0[0]) / 6;
		const c1y = p1[1] + (p2[1] - p0[1]) / 6;
		const c2x = p2[0] - (p3[0] - p1[0]) / 6;
		const c2y = p2[1] - (p3[1] - p1[1]) / 6;
		d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
	}
	return d;
};

// y on the polyline at horizontal progress t (0..1).
const yAt = (pts: Pt[], t: number): number => {
	const f = t * (pts.length - 1);
	const i = Math.min(Math.floor(f), pts.length - 2);
	const k = f - i;
	return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
};

const useSpring = (delay: number, config?: Parameters<typeof spring>[0]['config']) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return spring({frame: frame - delay, fps, config: {damping: 200, ...config}});
};

const typed = (text: string, frame: number, start: number, end: number) =>
	text.slice(0, Math.round(interpolate(frame, [start, end], [0, text.length], clamp)));

const Cursor: React.FC<{color?: string; height?: number}> = ({color = C.red, height = 34}) => {
	const frame = useCurrentFrame();
	return (
		<span
			style={{
				display: 'inline-block',
				width: 3,
				height,
				marginLeft: 4,
				background: color,
				opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
				verticalAlign: 'middle',
			}}
		/>
	);
};

/* Word-by-word masked slide-up, with optional accent words. */
const Words: React.FC<{
	text: string;
	start: number;
	stagger?: number;
	accent?: string;
	accentColor?: string;
	style?: CSSProperties;
}> = ({text, start, stagger = 3, accent = '', accentColor = C.red, style}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const accents = new Set(accent.toLowerCase().split(/\s+/).filter(Boolean));
	return (
		<div style={style}>
			{text.split(' ').map((word, i) => {
				const s = spring({
					frame: frame - start - i * stagger,
					fps,
					config: {damping: 16, stiffness: 150, mass: 0.8},
				});
				const isAccent = accents.has(word.toLowerCase());
				return (
					<span
						key={`${word}-${i}`}
						style={{
							display: 'inline-block',
							// Mask during the slide-up, then release so accent glows are not boxed in.
							overflow: frame - start - i * stagger > 24 ? 'visible' : 'hidden',
							verticalAlign: 'top',
							padding: '0.08em 0 0.14em',
							margin: '-0.08em 0.22em -0.14em 0',
						}}
					>
						<span
							style={{
								display: 'inline-block',
								transform: `translateY(${interpolate(s, [0, 1], [110, 0])}%) rotate(${(1 - s) * 7}deg)`,
								transformOrigin: 'left bottom',
								color: isAccent ? accentColor : undefined,
								textShadow: isAccent ? `0 0 48px ${accentColor}99` : undefined,
							}}
						>
							{word}
						</span>
					</span>
				);
			})}
		</div>
	);
};

const Eyebrow: React.FC<{children: React.ReactNode; delay?: number; color?: string}> = ({
	children,
	delay = 0,
	color = C.red,
}) => {
	const s = useSpring(delay);
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 14,
				fontFamily: MONO,
				fontSize: 20,
				letterSpacing: '0.2em',
				textTransform: 'uppercase',
				color: C.muted,
				opacity: s,
				transform: `translateX(${(1 - s) * -30}px)`,
			}}
		>
			<span style={{width: 12, height: 12, background: color}} />
			{children}
		</div>
	);
};

const Glass: React.FC<{style?: CSSProperties; children: React.ReactNode}> = ({style, children}) => (
	<div
		style={{
			position: 'absolute',
			borderRadius: 28,
			background: 'linear-gradient(160deg, rgba(251,250,246,0.07), rgba(251,250,246,0.02))',
			border: `1px solid ${C.line}`,
			boxShadow: '0 40px 120px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
			backdropFilter: 'blur(18px)',
			...style,
		}}
	>
		{children}
	</div>
);

const headline: CSSProperties = {
	fontFamily: FONT,
	fontWeight: 700,
	fontSize: 112,
	lineHeight: 1.0,
	letterSpacing: '-0.035em',
	color: C.paper,
};

const subline: CSSProperties = {
	fontFamily: FONT,
	fontWeight: 400,
	fontSize: 34,
	lineHeight: 1.35,
	color: C.muted,
};

/* ------------------------------------------------------------------ */
/* Scene wrapper: blur/scale cross-dissolve in and out                 */
/* ------------------------------------------------------------------ */

const SceneFade: React.FC<{duration: number; children: React.ReactNode}> = ({duration, children}) => {
	const frame = useCurrentFrame();
	const inP = interpolate(frame, [0, XFADE], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const outP = interpolate(frame, [duration - XFADE, duration], [1, 0], {
		...clamp,
		easing: Easing.in(Easing.cubic),
	});
	const blur = (1 - inP) * 12 + (1 - outP) * 12;
	const scale = interpolate(inP, [0, 1], [0.96, 1]) * interpolate(outP, [0, 1], [1.06, 1]);
	return (
		<AbsoluteFill
			style={{
				opacity: Math.min(inP, outP),
				transform: `scale(${scale})`,
				filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Persistent background: drifting grid, glow, grain, vignette         */
/* ------------------------------------------------------------------ */

const Backdrop: React.FC = () => {
	const frame = useCurrentFrame();
	const drift = frame * 0.35;
	return (
		<AbsoluteFill style={{background: C.ink}}>
			<AbsoluteFill
				style={{
					backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
					backgroundSize: '80px 80px',
					backgroundPosition: `${drift}px ${drift * 0.6}px`,
					opacity: 0.45,
					maskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 30%, transparent 100%)',
					WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 50% 50%, black 30%, transparent 100%)',
				}}
			/>
		</AbsoluteFill>
	);
};

const Grain: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<svg width="100%" height="100%" style={{opacity: 0.07, mixBlendMode: 'overlay'}}>
				<filter id="grain">
					<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 8} />
				</filter>
				<rect width="100%" height="100%" filter="url(#grain)" />
			</svg>
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)'}}
			/>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 1 - The problem                                               */
/* ------------------------------------------------------------------ */

const ProblemScene: React.FC<{hook: string; accent: string; sub: string}> = ({hook, accent, sub}) => {
	const frame = useCurrentFrame();
	const pulse = 0.5 + 0.5 * Math.sin(frame / 4.5);
	const card = useSpring(4, {damping: 18, stiffness: 90});
	const subIn = useSpring(34);

	const W = 700;
	const H = 360;
	const pts = useMemo<Pt[]>(
		() =>
			Array.from({length: 12}, (_, i) => {
				const t = i / 11;
				const wobble = (random(`drop-${i}`) - 0.5) * 50;
				return [t * W, 50 + Math.pow(t, 1.35) * (H - 100) + wobble];
			}),
		[],
	);
	const path = smoothPath(pts);
	const draw = interpolate(frame, [14, 72], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const dotX = draw * W;
	const dotY = yAt(pts, draw);
	const rank = Math.round(interpolate(draw, [0, 1], [4, 27]));
	const page = rank <= 10 ? 1 : rank <= 20 ? 2 : 3;
	const alarm = interpolate(frame, [60, 66, 84], [0, 1, 0.35], clamp);

	return (
		<AbsoluteFill>
			{/* red edge glow */}
			<AbsoluteFill
				style={{boxShadow: `inset 0 0 260px rgba(226,70,47,${0.28 * draw * (0.6 + 0.4 * pulse)})`}}
			/>
			<div
				style={{
					position: 'absolute',
					left: 980,
					top: 60,
					width: 1000,
					height: 1000,
					borderRadius: '50%',
					background: 'radial-gradient(circle, rgba(226,70,47,0.42), transparent 62%)',
					opacity: (0.35 + 0.35 * pulse) * card,
					transform: `scale(${0.8 + 0.3 * draw})`,
				}}
			/>

			<div style={{position: 'absolute', left: 140, top: 250, width: 860}}>
				<Eyebrow delay={2}>Search visibility alert</Eyebrow>
				<Words text={hook} accent={accent} start={6} stagger={4} style={{...headline, marginTop: 34}} />
				<div
					style={{
						...subline,
						marginTop: 36,
						maxWidth: 720,
						opacity: subIn,
						transform: `translateY(${(1 - subIn) * 24}px)`,
					}}
				>
					{sub}
				</div>
			</div>

			<Glass
				style={{
					left: 1040,
					top: 250,
					width: 760,
					height: 560,
					opacity: card,
					transform: `translateY(${(1 - card) * 80}px) rotateY(${(1 - card) * -18}deg)`,
					border: `1px solid rgba(226,70,47,${0.15 + 0.6 * alarm})`,
					boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 ${80 * alarm}px rgba(226,70,47,${0.5 * alarm})`,
				}}
			>
				<div style={{display: 'flex', justifyContent: 'space-between', padding: '30px 34px 0'}}>
					<div>
						<div style={{display: 'flex', alignItems: 'center', gap: 12}}>
							<span
								style={{
									width: 14,
									height: 14,
									borderRadius: '50%',
									background: C.red,
									boxShadow: `0 0 ${10 + 14 * pulse}px ${C.red}`,
								}}
							/>
							<span style={{fontFamily: FONT, fontSize: 26, fontWeight: 600, color: C.paper}}>
								Organic visibility
							</span>
						</div>
						<div style={{fontFamily: MONO, fontSize: 18, color: C.muted, marginTop: 10, letterSpacing: '0.08em'}}>
							LAST 12 MONTHS
						</div>
					</div>
					<div style={{textAlign: 'right'}}>
						<div style={{fontFamily: MONO, fontSize: 16, color: C.muted, letterSpacing: '0.12em'}}>
							YOUR POSITION
						</div>
						<div
							style={{
								fontFamily: FONT,
								fontWeight: 700,
								fontSize: 64,
								lineHeight: 1,
								color: C.red,
								textShadow: `0 0 30px rgba(226,70,47,0.6)`,
								fontVariantNumeric: 'tabular-nums',
							}}
						>
							#{rank}
						</div>
						<div style={{fontFamily: MONO, fontSize: 16, color: C.muted, marginTop: 4}}>PAGE {page}</div>
					</div>
				</div>

				<svg width={W} height={H} style={{position: 'absolute', left: 30, bottom: 30, overflow: 'visible'}}>
					<defs>
						<linearGradient id="dropFill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={C.red} stopOpacity={0.45} />
							<stop offset="100%" stopColor={C.red} stopOpacity={0} />
						</linearGradient>
						<clipPath id="dropClip">
							<rect x={-10} y={-40} width={dotX + 10} height={H + 80} />
						</clipPath>
						<filter id="dropGlow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="8" result="b" />
							<feMerge>
								<feMergeNode in="b" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
					</defs>
					{[0.25, 0.5, 0.75, 1].map((g) => (
						<line key={g} x1={0} x2={W} y1={g * H} y2={g * H} stroke={C.line} strokeDasharray="4 8" />
					))}
					<g clipPath="url(#dropClip)">
						<path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#dropFill)" />
						<path d={path} fill="none" stroke={C.red} strokeWidth={5} strokeLinecap="round" filter="url(#dropGlow)" />
					</g>
					<circle cx={dotX} cy={dotY} r={14 + 22 * pulse} fill={C.red} opacity={0.18 * (1 - pulse)} />
					<circle cx={dotX} cy={dotY} r={9} fill={C.paper} stroke={C.red} strokeWidth={4} />
				</svg>
			</Glass>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 2 - The solution                                              */
/* ------------------------------------------------------------------ */

const SearchIcon: React.FC<{size?: number; color?: string}> = ({size = 30, color = C.muted}) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
		<circle cx="10.5" cy="10.5" r="6.5" />
		<line x1="15.5" y1="15.5" x2="21" y2="21" />
	</svg>
);

const SolutionScene: React.FC<{
	headlineText: string;
	sub: string;
	query: string;
	business: string;
	domain: string;
}> = ({headlineText, sub, query, business, domain}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const panel = useSpring(4, {damping: 18, stiffness: 90});
	const subIn = useSpring(24);
	const text = typed(query, frame, 12, 36);
	const rise = spring({frame: frame - 42, fps, config: {damping: 14, stiffness: 80}});
	const found = useSpring(66, {damping: 12, stiffness: 160});
	const yourRowIn = useSpring(30);

	const ROW = 98;
	const bars = [0.28, 0.34, 0.31, 0.45, 0.52, 0.66, 0.8, 1];

	return (
		<AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: 1040,
					top: 120,
					width: 900,
					height: 900,
					borderRadius: '50%',
					background: 'radial-gradient(circle, rgba(255,159,67,0.22), transparent 62%)',
					opacity: panel,
				}}
			/>

			<div style={{position: 'absolute', left: 140, top: 240, width: 820}}>
				<Eyebrow delay={2} color={C.green}>
					The fix
				</Eyebrow>
				<Words text={headlineText} start={6} stagger={4} accent="found." accentColor={C.red} style={{...headline, marginTop: 34}} />
				<div style={{...subline, marginTop: 30, opacity: subIn, transform: `translateY(${(1 - subIn) * 24}px)`}}>
					{sub}
				</div>

				{/* rising bar chart */}
				<div style={{display: 'flex', alignItems: 'flex-end', gap: 16, height: 190, marginTop: 56, position: 'relative'}}>
					{bars.map((h, i) => {
						const s = spring({frame: frame - 26 - i * 4, fps, config: {damping: 13, stiffness: 120}});
						const last = i === bars.length - 1;
						return (
							<div
								key={i}
								style={{
									width: 54,
									height: 190 * h * s,
									borderRadius: '10px 10px 3px 3px',
									background: last
										? `linear-gradient(180deg, ${C.amber}, ${C.red})`
										: `linear-gradient(180deg, rgba(251,250,246,${0.2 + i * 0.07}), rgba(251,250,246,0.05))`,
									boxShadow: last ? `0 0 40px rgba(226,70,47,0.6)` : undefined,
								}}
							/>
						);
					})}
					<svg width={8 * 70} height={200} style={{position: 'absolute', left: 0, bottom: 0, overflow: 'visible'}}>
						<path
							d={smoothPath(bars.map((h, i) => [i * 70 + 27, 190 - 190 * h - 18] as Pt))}
							fill="none"
							stroke={C.paper}
							strokeWidth={3}
							strokeDasharray="1"
							pathLength={1}
							strokeDashoffset={1 - interpolate(frame, [44, 72], [0, 1], clamp)}
							strokeLinecap="round"
						/>
					</svg>
				</div>
			</div>

			<div
				style={{
					position: 'absolute',
					left: 1010,
					top: 230,
					width: 780,
					opacity: panel,
					transform: `translateY(${(1 - panel) * 70}px)`,
				}}
			>
				{/* glowing search bar */}
				<div
					style={{
						padding: 3,
						borderRadius: 999,
						background: `conic-gradient(from ${frame * 5}deg, ${C.red}, ${C.amber}, rgba(251,250,246,0.08) 35%, rgba(251,250,246,0.08) 65%, ${C.red})`,
						boxShadow: `0 0 70px rgba(226,70,47,0.35)`,
					}}
				>
					<div
						style={{
							height: 92,
							borderRadius: 999,
							background: '#151413',
							display: 'flex',
							alignItems: 'center',
							gap: 20,
							padding: '0 34px',
							fontFamily: FONT,
							fontSize: 34,
							color: C.paper,
						}}
					>
						<SearchIcon />
						<span>{text}</span>
						<Cursor />
					</div>
				</div>

				{/* results reorder: your listing climbs to the top */}
				<div style={{position: 'relative', height: ROW * 4, marginTop: 34}}>
					{[0, 1, 2].map((i) => {
						const s = spring({frame: frame - 30 - i * 3, fps, config: {damping: 200}});
						return (
							<div
								key={i}
								style={{
									position: 'absolute',
									left: 0,
									right: 0,
									top: (i + rise) * ROW,
									height: ROW - 16,
									borderRadius: 18,
									border: `1px solid ${C.line}`,
									background: 'rgba(251,250,246,0.03)',
									padding: '20px 26px',
									opacity: s * (1 - 0.35 * rise),
								}}
							>
								<div style={{width: 180 + i * 40, height: 14, borderRadius: 7, background: 'rgba(251,250,246,0.16)'}} />
								<div style={{width: 420 - i * 50, height: 12, borderRadius: 6, background: 'rgba(251,250,246,0.08)', marginTop: 14}} />
							</div>
						);
					})}
					{(() => {
						const s = yourRowIn;
						return (
							<div
								style={{
									position: 'absolute',
									left: 0,
									right: 0,
									top: (3 - 3 * rise) * ROW,
									height: ROW - 16,
									borderRadius: 18,
									border: `1px solid rgba(226,70,47,${0.3 + 0.5 * rise})`,
									background: `linear-gradient(90deg, rgba(226,70,47,${0.22 * rise}), rgba(251,250,246,0.04))`,
									boxShadow: `0 0 ${60 * rise}px rgba(226,70,47,${0.35 * rise})`,
									padding: '0 26px',
									display: 'flex',
									alignItems: 'center',
									gap: 20,
									opacity: s,
									transform: `scale(${1 + 0.03 * Math.sin(Math.PI * rise)})`,
									zIndex: 2,
								}}
							>
								<div style={{width: 18, height: 18, background: C.red, flexShrink: 0}} />
								<div style={{flex: 1}}>
									<div style={{fontFamily: FONT, fontWeight: 700, fontSize: 30, color: C.paper}}>{business}</div>
									<div style={{fontFamily: MONO, fontSize: 18, color: C.muted, marginTop: 4}}>{domain}</div>
								</div>
								<div
									style={{
										fontFamily: MONO,
										fontSize: 18,
										letterSpacing: '0.12em',
										color: C.ink,
										background: C.green,
										borderRadius: 999,
										padding: '8px 16px',
										transform: `scale(${found})`,
									}}
								>
									FOUND
								</div>
							</div>
						);
					})()}
				</div>
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 3 - Cited in AI answers                                       */
/* ------------------------------------------------------------------ */

const Sparkle: React.FC<{size: number; rotate: number}> = ({size, rotate}) => (
	<svg width={size} height={size} viewBox="-12 -12 24 24" style={{transform: `rotate(${rotate}deg)`}}>
		<defs>
			<linearGradient id="spark" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stopColor={C.amber} />
				<stop offset="100%" stopColor={C.red} />
			</linearGradient>
		</defs>
		<path d="M0 -11 C1.2 -3 3 -1.2 11 0 C3 1.2 1.2 3 0 11 C-1.2 3 -3 1.2 -11 0 C-3 -1.2 -1.2 -3 0 -11 Z" fill="url(#spark)" />
	</svg>
);

const AiScene: React.FC<{headlineText: string; prompt: string; business: string; domain: string}> = ({
	headlineText,
	prompt,
	business,
	domain,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const panel = useSpring(2, {damping: 18, stiffness: 90});
	const bubble = useSpring(6);
	const promptText = typed(prompt, frame, 8, 30);
	const answer = useSpring(30);
	const cite = spring({frame: frame - 50, fps, config: {damping: 11, stiffness: 140}});
	const platforms = ['AI Overviews', 'ChatGPT', 'Gemini', 'Copilot'];

	return (
		<AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: 980,
					top: 100,
					width: 1000,
					height: 1000,
					borderRadius: '50%',
					background: 'radial-gradient(circle, rgba(226,70,47,0.22), rgba(255,159,67,0.08) 40%, transparent 65%)',
				}}
			/>

			<div style={{position: 'absolute', left: 140, top: 290, width: 800}}>
				<Eyebrow delay={2} color={C.amber}>
					AI visibility
				</Eyebrow>
				<Words text={headlineText} start={4} stagger={4} accent="AI." accentColor={C.amber} style={{...headline, marginTop: 34}} />
				<div style={{display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 44}}>
					{platforms.map((p, i) => {
						const s = spring({frame: frame - 24 - i * 5, fps, config: {damping: 12, stiffness: 160}});
						return (
							<div
								key={p}
								style={{
									fontFamily: MONO,
									fontSize: 20,
									color: C.paper,
									border: `1px solid ${C.line}`,
									background: 'rgba(251,250,246,0.05)',
									borderRadius: 999,
									padding: '10px 20px',
									transform: `scale(${s})`,
									opacity: s,
								}}
							>
								{p}
							</div>
						);
					})}
				</div>
			</div>

			<Glass
				style={{
					left: 1030,
					top: 210,
					width: 760,
					height: 660,
					padding: 36,
					opacity: panel,
					transform: `translateY(${(1 - panel) * 70}px)`,
				}}
			>
				{/* user prompt */}
				<div style={{display: 'flex', justifyContent: 'flex-end', opacity: bubble, transform: `translateY(${(1 - bubble) * 20}px)`}}>
					<div
						style={{
							maxWidth: 560,
							background: 'rgba(251,250,246,0.10)',
							borderRadius: '26px 26px 6px 26px',
							padding: '20px 26px',
							fontFamily: FONT,
							fontSize: 28,
							lineHeight: 1.3,
							color: C.paper,
							minHeight: 36,
						}}
					>
						{promptText}
						{frame < 34 ? <Cursor height={28} color={C.paper} /> : null}
					</div>
				</div>

				{/* answer */}
				<div style={{display: 'flex', gap: 20, marginTop: 34, opacity: answer}}>
					<div style={{flexShrink: 0, marginTop: 2}}>
						<Sparkle size={44} rotate={frame * 3} />
					</div>
					<div style={{flex: 1}}>
						{[0.95, 0.82, 0.9].map((w, i) => {
							const s = interpolate(frame, [32 + i * 5, 46 + i * 5], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
							return (
								<div
									key={i}
									style={{
										height: 16,
										width: `${w * 100 * s}%`,
										borderRadius: 8,
										marginTop: i === 0 ? 12 : 18,
										background: `linear-gradient(90deg, rgba(251,250,246,0.22), rgba(251,250,246,0.08))`,
									}}
								/>
							);
						})}
						<div
							style={{
								marginTop: 30,
								fontFamily: FONT,
								fontSize: 30,
								lineHeight: 1.35,
								color: C.paper,
								opacity: interpolate(frame, [44, 54], [0, 1], clamp),
							}}
						>
							A strong local option is{' '}
							<span
								style={{
									fontWeight: 700,
									background: `linear-gradient(90deg, rgba(226,70,47,${0.35 * cite}), rgba(255,159,67,${0.25 * cite}))`,
									borderRadius: 8,
									padding: '0 8px',
								}}
							>
								{business}
							</span>
							.
						</div>

						{/* citation card */}
						<div
							style={{
								marginTop: 30,
								display: 'flex',
								alignItems: 'center',
								gap: 16,
								padding: '18px 22px',
								borderRadius: 18,
								border: `1px solid rgba(226,70,47,${0.7 * cite})`,
								background: 'rgba(17,16,15,0.6)',
								boxShadow: `0 0 ${50 * cite}px rgba(226,70,47,0.45)`,
								transform: `translateY(${(1 - cite) * 40}px) scale(${0.9 + 0.1 * cite})`,
								opacity: cite,
							}}
						>
							<div
								style={{
									width: 38,
									height: 38,
									borderRadius: 10,
									background: C.red,
									color: C.paper,
									fontFamily: MONO,
									fontSize: 20,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								1
							</div>
							<div>
								<div style={{fontFamily: MONO, fontSize: 16, color: C.muted, letterSpacing: '0.1em'}}>SOURCE</div>
								<div style={{fontFamily: FONT, fontWeight: 600, fontSize: 26, color: C.paper}}>{domain}</div>
							</div>
						</div>
					</div>
				</div>
			</Glass>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 4 - Heatmap zoom into a phone search                          */
/* ------------------------------------------------------------------ */

const COLS = 32;
const ROWS = 18;
const CELL = 50;
const GAP = 4;
const PITCH = CELL + GAP;
const GRID_W = COLS * PITCH;
const GRID_H = ROWS * PITCH;
const HOT: Pt = [23, 6];

const gauss = (x: number, y: number, cx: number, cy: number, s: number) =>
	Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));

const heatColor = (v: number) =>
	interpolateColors(v, [0, 0.3, 0.55, 0.75, 0.9, 1], ['#161412', '#2a1310', '#7a2416', C.red, C.amber, '#fff1d6']);

const HeatmapZoom: React.FC<{zoomStart: number; zoomEnd: number}> = ({zoomStart, zoomEnd}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const noise = useMemo(
		() => Array.from({length: COLS * ROWS}, (_, i) => random(`heat-${i}`)),
		[],
	);

	const hot = interpolate(frame, [0, 46], [0.25, 1], clamp);
	const push = interpolate(frame, [0, zoomStart], [1, 1.9], {...clamp, easing: Easing.out(Easing.quad)});
	const dive = interpolate(frame, [zoomStart, zoomEnd], [1, 14], {...clamp, easing: Easing.in(Easing.exp)});
	const scale = push * dive;
	const rx = interpolate(frame, [0, zoomStart, zoomEnd], [54, 20, 0], clamp);
	const rz = interpolate(frame, [0, zoomStart, zoomEnd], [-16, -5, 0], clamp);
	const focus = interpolate(frame, [6, zoomEnd - 4], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});

	const gridLeft = (WIDTH - GRID_W) / 2;
	const gridTop = (HEIGHT - GRID_H) / 2;
	const hx = HOT[0] * PITCH + CELL / 2;
	const hy = HOT[1] * PITCH + CELL / 2;
	const dx = (WIDTH / 2 - (gridLeft + hx)) * focus;
	const dy = (HEIGHT / 2 - (gridTop + hy)) * focus;

	const reticle = spring({frame: frame - 22, fps, config: {damping: 14, stiffness: 120}});
	const box = interpolate(reticle, [0, 1], [260, 96]);
	const scanY = interpolate(frame, [0, 56], [-100, HEIGHT + 100], clamp);
	const hud = useSpring(4);
	const clicks = Math.round(interpolate(frame, [4, 56], [312, 12480], clamp));
	const heatPct = Math.round(interpolate(frame, [4, 50], [41, 94], clamp));

	const dots = useMemo(
		() =>
			Array.from({length: 18}, (_, i) => ({
				sx: random(`dx-${i}`) * WIDTH,
				sy: random(`dy-${i}`) > 0.5 ? -40 + random(`dz-${i}`) * 300 : HEIGHT - random(`dz-${i}`) * 300,
				delay: random(`dd-${i}`) * 22,
				arc: (random(`da-${i}`) - 0.5) * 360,
			})),
		[],
	);

	return (
		<AbsoluteFill style={{perspective: 1400, overflow: 'hidden'}}>
			<div
				style={{
					position: 'absolute',
					left: gridLeft,
					top: gridTop,
					width: GRID_W,
					height: GRID_H,
					transformOrigin: `${hx}px ${hy}px`,
					transform: `translate(${dx}px, ${dy}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${scale})`,
				}}
			>
				{noise.map((n, i) => {
					const x = i % COLS;
					const y = Math.floor(i / COLS);
					const wave = 0.5 * (Math.sin(x * 0.45 + frame * 0.12) + Math.cos(y * 0.55 - frame * 0.09));
					const v = Math.min(
						1,
						Math.max(
							0,
							0.16 +
								0.1 * wave +
								0.12 * n +
								0.85 * hot * gauss(x, y, HOT[0], HOT[1], 3.1) +
								0.4 * gauss(x, y, 8, 12, 2.6) * (0.7 + 0.3 * Math.sin(frame / 6)) +
								0.3 * gauss(x, y, 15, 3, 2.2),
						),
					);
					const color = heatColor(v);
					return (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: x * PITCH,
								top: y * PITCH,
								width: CELL,
								height: CELL,
								borderRadius: 6,
								background: color,
								boxShadow: v > 0.72 ? `0 0 ${24 * v}px ${color}` : undefined,
							}}
						/>
					);
				})}
			</div>

			{/* session dots converging on the hotspot */}
			<svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', inset: 0}}>
				{dots.map((d, i) => {
					const trail = [0, 2, 4, 6, 8];
					return (
						<g key={i}>
							{trail.map((lag) => {
								const t = interpolate(frame - lag, [6 + d.delay, 48 + d.delay], [0, 1], {
									...clamp,
									easing: Easing.inOut(Easing.cubic),
								});
								if (t <= 0 || t >= 1) return null;
								const ex = WIDTH / 2;
								const ey = HEIGHT / 2;
								const px = d.sx + (ex - d.sx) * t;
								const py = d.sy + (ey - d.sy) * t;
								const len = Math.hypot(ex - d.sx, ey - d.sy) || 1;
								const off = Math.sin(Math.PI * t) * d.arc;
								return (
									<circle
										key={lag}
										cx={px + (-(ey - d.sy) / len) * off}
										cy={py + ((ex - d.sx) / len) * off}
										r={lag === 0 ? 6 : 5 - lag * 0.45}
										fill={lag === 0 ? C.paper : C.amber}
										opacity={lag === 0 ? 0.95 : 0.5 - lag * 0.05}
									/>
								);
							})}
						</g>
					);
				})}
			</svg>

			{/* scan line */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: scanY,
					height: 2,
					background: `linear-gradient(90deg, transparent, ${C.amber}, transparent)`,
					boxShadow: `0 0 30px ${C.amber}`,
					opacity: 0.7,
				}}
			/>

			{/* reticle */}
			<div
				style={{
					position: 'absolute',
					left: WIDTH / 2 - box / 2,
					top: HEIGHT / 2 - box / 2,
					width: box,
					height: box,
					opacity: reticle * interpolate(frame, [zoomStart, zoomStart + 8], [1, 0], clamp),
				}}
			>
				{[
					{left: 0, top: 0, borderLeft: 3, borderTop: 3},
					{right: 0, top: 0, borderRight: 3, borderTop: 3},
					{left: 0, bottom: 0, borderLeft: 3, borderBottom: 3},
					{right: 0, bottom: 0, borderRight: 3, borderBottom: 3},
				].map((b, i) => (
					<div
						key={i}
						style={{
							position: 'absolute',
							width: 26,
							height: 26,
							borderColor: C.paper,
							borderStyle: 'solid',
							borderWidth: `${b.borderTop ?? 0}px ${b.borderRight ?? 0}px ${b.borderBottom ?? 0}px ${b.borderLeft ?? 0}px`,
							left: b.left,
							right: b.right,
							top: b.top,
							bottom: b.bottom,
						}}
					/>
				))}
				<div
					style={{
						position: 'absolute',
						left: box + 16,
						top: -4,
						fontFamily: MONO,
						fontSize: 18,
						color: C.paper,
						whiteSpace: 'nowrap',
						letterSpacing: '0.12em',
						opacity: interpolate(frame, [34, 38], [0, 1], clamp),
					}}
				>
					HIGH INTENT · LOCKED
				</div>
			</div>

			{/* HUD */}
			<div style={{position: 'absolute', left: 80, top: 70, opacity: hud}}>
				<Eyebrow delay={2}>Live demand map</Eyebrow>
				<div style={{...headline, fontSize: 64, marginTop: 20}}>Tracking real buyer intent.</div>
			</div>
			<div
				style={{
					position: 'absolute',
					left: 80,
					bottom: 70,
					display: 'flex',
					gap: 56,
					fontFamily: MONO,
					color: C.paper,
					opacity: hud,
				}}
			>
				{[
					['SEARCHES', clicks.toLocaleString('en-US')],
					['CLICK HEAT', `${heatPct}%`],
					['SIGNAL', frame > 36 ? 'HOT' : 'SCANNING'],
				].map(([k, v]) => (
					<div key={k}>
						<div style={{fontSize: 16, color: C.muted, letterSpacing: '0.16em'}}>{k}</div>
						<div style={{fontSize: 38, marginTop: 6, fontVariantNumeric: 'tabular-nums'}}>{v}</div>
					</div>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					right: 80,
					top: 78,
					display: 'flex',
					alignItems: 'center',
					gap: 12,
					fontFamily: MONO,
					fontSize: 18,
					color: C.paper,
					letterSpacing: '0.16em',
					opacity: hud,
				}}
			>
				<span style={{width: 14, height: 14, borderRadius: '50%', background: C.red, opacity: Math.floor(frame / 10) % 2 ? 0.25 : 1}} />
				REC
			</div>
		</AbsoluteFill>
	);
};

const MapTile: React.FC<{pinDrop: number; pulse: number}> = ({pinDrop, pulse}) => (
	<svg width="100%" height="100%" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice">
		<rect width="340" height="200" fill="#ece8df" />
		<path d="M-10 60 C80 40 140 90 350 70" stroke="#fff" strokeWidth="14" fill="none" />
		<path d="M-10 150 C90 170 220 120 350 150" stroke="#fff" strokeWidth="10" fill="none" />
		<path d="M110 -10 C120 60 90 140 120 210" stroke="#fff" strokeWidth="10" fill="none" />
		<path d="M250 -10 C240 80 270 150 250 210" stroke="#fff" strokeWidth="8" fill="none" />
		<ellipse cx="300" cy="30" rx="50" ry="26" fill="#cfe3c8" />
		<ellipse cx="40" cy="100" rx="34" ry="22" fill="#cfe3c8" />
		<circle cx="178" cy="104" r={16 + 30 * pulse} fill={C.red} opacity={0.25 * (1 - pulse)} />
		<g transform={`translate(178 ${104 - (1 - pinDrop) * 80})`} opacity={Math.min(1, pinDrop * 3)}>
			<path d="M0 0 C-14 -18 -16 -24 -16 -30 A16 16 0 1 1 16 -30 C16 -24 14 -18 0 0 Z" fill={C.red} />
			<rect x="-5" y="-35" width="10" height="10" fill={C.paper} />
		</g>
	</svg>
);

const PhoneInHand: React.FC<{query: string; business: string}> = ({query, business}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const rise = spring({frame, fps, config: {damping: 16, stiffness: 70}});
	const text = typed(query, frame, 8, 26);
	const map = useSpring(22);
	const pinDrop = spring({frame: frame - 26, fps, config: {damping: 9, stiffness: 180}});
	const pulse = ((frame - 26) % 24) / 24;
	const card = spring({frame: frame - 30, fps, config: {damping: 14, stiffness: 120}});
	const tap = interpolate(frame, [44, 56], [0, 1], clamp);
	const press = frame >= 44 && frame < 50 ? 0.94 : 1;

	const skin = 'url(#handSkin)';
	return (
		<div
			style={{
				position: 'absolute',
				left: 1060,
				top: 70,
				width: 700,
				height: 1000,
				transform: `translateY(${(1 - rise) * 700}px) rotate(${interpolate(rise, [0, 1], [-12, -5])}deg)`,
				transformOrigin: '50% 100%',
			}}
		>
			<svg width={700} height={1000} style={{position: 'absolute', inset: 0}}>
				<defs>
					<linearGradient id="handSkin" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="#3a302b" />
						<stop offset="100%" stopColor="#1d1816" />
					</linearGradient>
				</defs>
				{/* palm, behind the phone */}
				<path d="M250 1000 C250 880 300 800 420 770 C520 745 640 790 700 860 L700 1000 Z" fill={skin} />
			</svg>

			{/* phone */}
			<div
				style={{
					position: 'absolute',
					left: 150,
					top: 80,
					width: 400,
					height: 820,
					borderRadius: 64,
					background: '#0b0a09',
					padding: 14,
					boxShadow: `0 60px 140px rgba(0,0,0,0.7), 0 0 0 2px #2a2724, 0 0 80px rgba(226,70,47,0.25)`,
				}}
			>
				<div
					style={{
						position: 'relative',
						width: '100%',
						height: '100%',
						borderRadius: 50,
						overflow: 'hidden',
						background: C.paper,
						fontFamily: FONT,
					}}
				>
					{/* status bar + island */}
					<div style={{display: 'flex', justifyContent: 'space-between', padding: '20px 30px 0', fontSize: 17, fontWeight: 600, color: C.ink}}>
						<span>9:41</span>
						<span style={{display: 'flex', gap: 5, alignItems: 'center'}}>
							<span style={{width: 18, height: 10, background: C.ink, borderRadius: 2}} />
							<span style={{width: 24, height: 11, border: `2px solid ${C.ink}`, borderRadius: 3}} />
						</span>
					</div>
					<div style={{position: 'absolute', left: '50%', top: 12, width: 110, height: 32, marginLeft: -55, borderRadius: 20, background: '#0b0a09'}} />

					{/* search field */}
					<div
						style={{
							margin: '28px 20px 0',
							height: 60,
							borderRadius: 30,
							background: '#fff',
							boxShadow: '0 4px 18px rgba(17,16,15,0.12)',
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							padding: '0 20px',
							fontSize: 22,
							color: C.ink,
						}}
					>
						<SearchIcon size={22} color="#6b665e" />
						<span>{text}</span>
						{frame < 30 ? <Cursor height={24} /> : null}
					</div>

					{/* map */}
					<div
						style={{
							margin: '18px 20px 0',
							height: 220,
							borderRadius: 22,
							overflow: 'hidden',
							opacity: map,
							transform: `translateY(${(1 - map) * 20}px)`,
						}}
					>
						<MapTile pinDrop={pinDrop} pulse={frame > 26 ? pulse : 0} />
					</div>

					{/* top result */}
					<div
						style={{
							margin: '16px 20px 0',
							padding: '18px 18px',
							borderRadius: 20,
							background: '#fff',
							borderLeft: `6px solid ${C.red}`,
							boxShadow: `0 10px 30px rgba(226,70,47,${0.25 * card})`,
							transform: `translateY(${(1 - card) * 40}px)`,
							opacity: card,
						}}
					>
						<div style={{fontSize: 24, fontWeight: 700, color: C.ink}}>{business}</div>
						<div style={{fontSize: 16, color: '#6b665e', marginTop: 4}}>
							<span style={{color: '#1f8f5f', fontWeight: 600}}>Open now</span> · 2.1 mi
						</div>
						<div style={{display: 'flex', gap: 10, marginTop: 14}}>
							<div
								style={{
									position: 'relative',
									flex: 1,
									height: 46,
									borderRadius: 23,
									background: C.red,
									color: C.paper,
									fontWeight: 700,
									fontSize: 19,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									transform: `scale(${press})`,
									overflow: 'visible',
								}}
							>
								Call now
								{tap > 0 && tap < 1 ? (
									<span
										style={{
											position: 'absolute',
											left: '50%',
											top: '50%',
											width: 200,
											height: 200,
											marginLeft: -100,
											marginTop: -100,
											borderRadius: '50%',
											border: `3px solid ${C.red}`,
											transform: `scale(${0.2 + tap})`,
											opacity: 1 - tap,
										}}
									/>
								) : null}
							</div>
							<div
								style={{
									flex: 1,
									height: 46,
									borderRadius: 23,
									border: '2px solid #d8d3c9',
									color: C.ink,
									fontWeight: 600,
									fontSize: 19,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								Directions
							</div>
						</div>
					</div>

					{/* other results */}
					{[0, 1].map((i) => {
						const s = spring({frame: frame - 34 - i * 4, fps, config: {damping: 200}});
						return (
							<div key={i} style={{margin: '12px 20px 0', padding: 18, borderRadius: 18, background: '#f1eee7', opacity: s * 0.9}}>
								<div style={{width: 170 - i * 30, height: 14, borderRadius: 7, background: '#d8d3c9'}} />
								<div style={{width: 240, height: 11, borderRadius: 6, background: '#e4e0d7', marginTop: 10}} />
							</div>
						);
					})}
				</div>
			</div>

			{/* fingers and thumb, in front of the phone */}
			<svg width={700} height={1000} style={{position: 'absolute', inset: 0}}>
				{[470, 548, 626].map((y, i) => (
					<rect key={y} x={98 - i * 4} y={y} width={66} height={60} rx={30} fill={skin} stroke="rgba(226,70,47,0.35)" strokeWidth={1.5} />
				))}
				<path
					d="M600 1000 C590 930 560 860 548 790 C542 752 572 732 596 752 C630 790 660 880 690 1000 Z"
					fill={skin}
					stroke="rgba(226,70,47,0.35)"
					strokeWidth={1.5}
				/>
			</svg>
		</div>
	);
};

const DataScene: React.FC<{headlineText: string; query: string; business: string}> = ({headlineText, query, business}) => {
	const frame = useCurrentFrame();
	const zoomStart = 44;
	const zoomEnd = 66;
	const phoneFrom = 60;
	const heatOpacity = interpolate(frame, [62, 70], [1, 0], clamp);
	const flash = interpolate(frame, [58, 63, 70], [0, 0.95, 0], clamp);

	return (
		<AbsoluteFill>
			<AbsoluteFill style={{opacity: heatOpacity}}>
				<HeatmapZoom zoomStart={zoomStart} zoomEnd={zoomEnd} />
			</AbsoluteFill>

			<Sequence from={phoneFrom} layout="none">
				<AbsoluteFill>
					<div
						style={{
							position: 'absolute',
							left: 900,
							top: 80,
							width: 1100,
							height: 1100,
							borderRadius: '50%',
							background: 'radial-gradient(circle, rgba(226,70,47,0.3), transparent 60%)',
						}}
					/>
					<div style={{position: 'absolute', left: 140, top: 330, width: 820}}>
						<Eyebrow delay={4}>Near me, right now</Eyebrow>
						<Words text={headlineText} start={8} stagger={4} accent="search." style={{...headline, marginTop: 34}} />
					</div>
					<PhoneInHand query={query} business={business} />
				</AbsoluteFill>
			</Sequence>

			<AbsoluteFill style={{background: '#fff4ea', opacity: flash, mixBlendMode: 'screen'}} />
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 5 - Call to action                                            */
/* ------------------------------------------------------------------ */

const CtaScene: React.FC<{text: string; accent: string; button: string; url: string}> = ({text, accent, button, url}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const mark = useSpring(0, {damping: 16, stiffness: 120});
	const btn = spring({frame: frame - 30, fps, config: {damping: 11, stiffness: 140}});
	const urlIn = useSpring(44);
	const breathe = 1 + 0.035 * Math.sin((frame - 30) / 5) * interpolate(frame, [40, 50], [0, 1], clamp);

	// cursor glides in and clicks at CLICK
	const CLICK = 62;
	const glide = interpolate(frame, [42, CLICK], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const pressed = frame >= CLICK && frame < CLICK + 5;
	const burst = interpolate(frame, [CLICK, CLICK + 20], [0, 1], clamp);

	const particles = useMemo(
		() =>
			Array.from({length: 70}, (_, i) => ({
				a: random(`pa-${i}`) * Math.PI * 2,
				r: 500 + random(`pr-${i}`) * 700,
				speed: 0.4 + random(`ps-${i}`) * 0.8,
				size: 2 + random(`pz-${i}`) * 4,
			})),
		[],
	);

	const BTN_Y = 760;

	return (
		<AbsoluteFill>
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 60% 55% at 50% 62%, rgba(226,70,47,${0.28 + 0.08 * Math.sin(frame / 6)}), transparent 70%)`,
				}}
			/>

			{/* inward particle drift */}
			<svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', inset: 0}}>
				{particles.map((p, i) => {
					const t = ((frame * p.speed * 0.012 + i / particles.length) % 1 + 1) % 1;
					const r = p.r * (1 - t);
					return (
						<circle
							key={i}
							cx={WIDTH / 2 + Math.cos(p.a) * r * 1.4}
							cy={BTN_Y + Math.sin(p.a) * r * 0.8}
							r={p.size * (1 - t * 0.6)}
							fill={i % 3 === 0 ? C.red : C.paper}
							opacity={0.5 * Math.sin(Math.PI * t)}
						/>
					);
				})}
			</svg>

			{/* sonar rings behind the button */}
			{[0, 1, 2].map((k) => {
				const t = (((frame - 36 + k * 14) % 42) + 42) % 42 / 42;
				return (
					<div
						key={k}
						style={{
							position: 'absolute',
							left: WIDTH / 2 - 330,
							top: BTN_Y - 60,
							width: 660,
							height: 120,
							borderRadius: 999,
							border: `2px solid ${C.red}`,
							transform: `scale(${1 + t * 0.6}, ${1 + t * 1.6})`,
							opacity: frame > 36 ? (1 - t) * 0.55 : 0,
						}}
					/>
				);
			})}

			{/* wordmark */}
			<div
				style={{
					position: 'absolute',
					top: 150,
					width: '100%',
					textAlign: 'center',
					fontFamily: FONT,
					fontWeight: 600,
					fontSize: 40,
					letterSpacing: '0.02em',
					color: C.paper,
					opacity: mark,
					transform: `translateY(${(1 - mark) * -20}px)`,
				}}
			>
				BURNWORTH<span style={{color: C.red}}>.</span>
			</div>

			<Words
				text={text}
				start={6}
				stagger={3}
				accent={accent}
				style={{
					...headline,
					fontSize: 104,
					position: 'absolute',
					top: 290,
					left: 180,
					right: 180,
					textAlign: 'center',
				}}
			/>

			{/* button */}
			<div
				style={{
					position: 'absolute',
					left: WIDTH / 2 - 330,
					top: BTN_Y - 60,
					width: 660,
					height: 120,
					borderRadius: 999,
					background: `linear-gradient(135deg, ${C.red}, #ff6a3d)`,
					boxShadow: `0 20px 80px rgba(226,70,47,${0.55 + 0.2 * Math.sin(frame / 5)}), inset 0 1px 0 rgba(255,255,255,0.35)`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 18,
					fontFamily: FONT,
					fontWeight: 700,
					fontSize: 40,
					color: C.paper,
					overflow: 'hidden',
					opacity: btn,
					transform: `scale(${btn * breathe * (pressed ? 0.95 : 1)})`,
				}}
			>
				{/* shimmer */}
				<div
					style={{
						position: 'absolute',
						top: 0,
						bottom: 0,
						width: 160,
						left: interpolate((frame - 40) % 40, [0, 40], [-200, 860]),
						background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
						transform: 'skewX(-20deg)',
						opacity: frame > 40 ? 1 : 0,
					}}
				/>
				<span style={{position: 'relative'}}>{button}</span>
				<svg width={34} height={34} viewBox="0 0 24 24" style={{position: 'relative'}} fill="none" stroke={C.paper} strokeWidth={2.6} strokeLinecap="round">
					<line x1="4" y1="12" x2="19" y2="12" />
					<polyline points="13,6 19,12 13,18" />
				</svg>
			</div>

			{/* click burst */}
			{burst > 0 && burst < 1 ? (
				<div
					style={{
						position: 'absolute',
						left: WIDTH / 2 + 120 - 60,
						top: BTN_Y + 10 - 60,
						width: 120,
						height: 120,
						borderRadius: '50%',
						border: `4px solid ${C.paper}`,
						transform: `scale(${0.3 + burst * 2})`,
						opacity: 1 - burst,
					}}
				/>
			) : null}

			{/* pointer */}
			<svg
				width={44}
				height={44}
				viewBox="0 0 24 24"
				style={{
					position: 'absolute',
					left: interpolate(glide, [0, 1], [WIDTH / 2 + 520, WIDTH / 2 + 120]),
					top: interpolate(glide, [0, 1], [BTN_Y + 260, BTN_Y + 10]),
					opacity: interpolate(frame, [40, 46], [0, 1], clamp),
					transform: `scale(${pressed ? 0.85 : 1})`,
					filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))',
				}}
			>
				<path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.7 L11 13.4 L18 13.4 Z" fill={C.paper} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
			</svg>

			<div
				style={{
					position: 'absolute',
					top: BTN_Y + 110,
					width: '100%',
					textAlign: 'center',
					fontFamily: MONO,
					fontSize: 26,
					letterSpacing: '0.14em',
					color: C.muted,
					opacity: urlIn,
				}}
			>
				{url}
			</div>
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Main composition                                                    */
/* ------------------------------------------------------------------ */

export const SeoAnimation: React.FC<SeoAnimationProps> = (props) => {
	const p = {...defaultSeoProps, ...props};
	return (
		<AbsoluteFill style={{background: C.ink, fontFamily: FONT}}>
			<Backdrop />

			<Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration} name="1 Problem">
				<SceneFade duration={SCENES.problem.duration}>
					<ProblemScene hook={p.hook} accent={p.hookAccent} sub={p.hookSub} />
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.solution.from} durationInFrames={SCENES.solution.duration} name="2 Solution">
				<SceneFade duration={SCENES.solution.duration}>
					<SolutionScene
						headlineText={p.solution}
						sub={p.solutionSub}
						query={p.solutionQuery}
						business={p.businessName}
						domain={p.businessDomain}
					/>
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.ai.from} durationInFrames={SCENES.ai.duration} name="3 AI answers">
				<SceneFade duration={SCENES.ai.duration}>
					<AiScene headlineText={p.aiHeadline} prompt={p.aiPrompt} business={p.businessName} domain={p.businessDomain} />
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.data.from} durationInFrames={SCENES.data.duration} name="4 Data to phone">
				<SceneFade duration={SCENES.data.duration}>
					<DataScene headlineText={p.dataHeadline} query={p.phoneQuery} business={p.businessName} />
				</SceneFade>
			</Sequence>

			<Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration} name="5 Call to action">
				<SceneFade duration={SCENES.cta.duration}>
					<CtaScene text={p.ctaHeadline} accent={p.ctaAccent} button={p.ctaButton} url={p.url} />
				</SceneFade>
			</Sequence>

			<Grain />
		</AbsoluteFill>
	);
};
