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
export const DURATION_IN_FRAMES = 17 * FPS; // 510

// Scenes overlap by XFADE frames so every cut is a cross-dissolve.
const XFADE = 12;
const SCENES = {
	problem: {from: 0, duration: 90},
	solution: {from: 78, duration: 90},
	ai: {from: 156, duration: 72},
	// Heatmap -> phone -> city -> globe -> CTA is one continuous camera move.
	finale: {from: 216, duration: 294},
} as const;

// Finale beats, in frames from the start of the finale.
const FIN = {
	phoneFrom: 60, // phone rises out of the heatmap flash
	pushStart: 102, // camera starts pushing into the phone's map
	pushEnd: 122, // map fills the frame; hand-off to the full-screen city
	cityOutEnd: 166, // city has shrunk to a glow
	globeFrom: 148, // globe starts, zoomed in on the city
	globeSettled: 184,
	ctaFrom: 166,
} as const;

// City map: the phone's map is the same render, so the push-in cut is seamless.
const PHONE_MAP_W = 332;
const PHONE_MAP_H = 220;
const CITY_ZOOM = 3.2; // full-screen zoom at the hand-off
const PUSH_SCALE = WIDTH / PHONE_MAP_W;
const UI_BOOST = 2.2; // pin and icon size multiplier inside the phone

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

// Thermal spectrum for every heat map: cool blue -> cyan -> teal -> yellow -> orange -> red-orange.
const HEAT = {
	deep: '#1c2a5e',
	blue: '#2f6bff',
	cyan: '#22c7f0',
	teal: '#2fd9a4',
	yellow: '#ffd23f',
	orange: '#ff8a3d',
	hot: '#ff4d3d',
};

// Lifted night-blue base instead of near-black, so the piece reads vibrant, not heavy.
const BG = {
	base: '#161d33',
	deep: '#10162a',
	glowA: 'rgba(47,107,255,0.30)',
	glowB: 'rgba(255,138,61,0.16)',
	glowC: 'rgba(34,199,240,0.14)',
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
		<AbsoluteFill
			style={{
				background: `radial-gradient(ellipse 60% 55% at ${22 + 6 * Math.sin(frame / 90)}% ${20 + 5 * Math.cos(frame / 70)}%, ${BG.glowA}, transparent 70%),
					radial-gradient(ellipse 55% 50% at ${82 - 5 * Math.sin(frame / 80)}% ${84 - 4 * Math.cos(frame / 60)}%, ${BG.glowB}, transparent 70%),
					radial-gradient(ellipse 45% 40% at 70% 18%, ${BG.glowC}, transparent 70%),
					linear-gradient(160deg, ${BG.base}, ${BG.deep})`,
			}}
		>
			<AbsoluteFill
				style={{
					backgroundImage: `linear-gradient(rgba(140,170,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(140,170,255,0.10) 1px, transparent 1px)`,
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
				style={{background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(8,12,26,0.35) 100%)'}}
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
							background: '#1a2242',
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
	const promptText = typed(prompt, frame, 8, 26);
	const answer = useSpring(26);
	const cite = spring({frame: frame - 44, fps, config: {damping: 11, stiffness: 140}});
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
						{frame < 30 ? <Cursor height={28} color={C.paper} /> : null}
					</div>
				</div>

				{/* answer */}
				<div style={{display: 'flex', gap: 20, marginTop: 34, opacity: answer}}>
					<div style={{flexShrink: 0, marginTop: 2}}>
						<Sparkle size={44} rotate={frame * 3} />
					</div>
					<div style={{flex: 1}}>
						{[0.95, 0.82, 0.9].map((w, i) => {
							const s = interpolate(frame, [28 + i * 5, 40 + i * 5], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
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
								opacity: interpolate(frame, [38, 48], [0, 1], clamp),
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
	interpolateColors(
		v,
		[0, 0.18, 0.36, 0.52, 0.68, 0.84, 1],
		[HEAT.deep, HEAT.blue, HEAT.cyan, HEAT.teal, HEAT.yellow, HEAT.orange, HEAT.hot],
	);

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
						background: 'rgba(14,20,42,0.8)',
						padding: '6px 12px',
						borderRadius: 6,
						opacity: interpolate(frame, [34, 38], [0, 1], clamp),
					}}
				>
					HIGH INTENT · LOCKED
				</div>
			</div>

			{/* bands behind the HUD so the text reads over bright cells */}
			<AbsoluteFill
				style={{
					background:
						'linear-gradient(180deg, rgba(14,20,42,0.78) 0%, rgba(14,20,42,0) 26%, rgba(14,20,42,0) 76%, rgba(14,20,42,0.78) 100%)',
				}}
			/>

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

/* City map with searchers (phones) driving to the pin                 */

const BLOCK = 120; // world units between streets
const EXTENT = 3600;

type Agent = {path: Pt[]; len: number; speed: number; phase: number};

const AGENTS: Agent[] = Array.from({length: 22}, (_, i) => {
	const ax = Math.round((random(`ax-${i}`) - 0.5) * 26) || 4;
	const by = Math.round((random(`by-${i}`) - 0.5) * 26) || -5;
	const start: Pt = [ax * BLOCK, by * BLOCK];
	const mid: Pt = random(`hf-${i}`) > 0.5 ? [0, by * BLOCK] : [ax * BLOCK, 0];
	return {
		path: [start, mid, [0, 0]],
		len: (Math.abs(ax) + Math.abs(by)) * BLOCK,
		speed: 16 + random(`sp-${i}`) * 16,
		phase: random(`ph-${i}`),
	};
});

const posAt = (a: Agent, d: number): Pt => {
	let rest = Math.max(0, d);
	for (let i = 0; i < a.path.length - 1; i++) {
		const [x0, y0] = a.path[i];
		const [x1, y1] = a.path[i + 1];
		const seg = Math.abs(x1 - x0) + Math.abs(y1 - y0);
		if (rest <= seg || i === a.path.length - 2) {
			const k = seg === 0 ? 1 : Math.min(1, rest / seg);
			return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
		}
		rest -= seg;
	}
	return a.path[a.path.length - 1];
};

const BUILDINGS = (() => {
	const out: {x: number; y: number; w: number; h: number}[] = [];
	for (let bx = -9; bx < 9; bx++) {
		for (let by = -9; by < 9; by++) {
			const n = 2 + Math.floor(random(`bn-${bx}-${by}`) * 3);
			for (let k = 0; k < n; k++) {
				const r = (key: string) => random(`b-${bx}-${by}-${k}-${key}`);
				const w = 22 + r('w') * 38;
				const h = 22 + r('h') * 38;
				out.push({x: bx * BLOCK + 14 + r('x') * (BLOCK - 28 - w), y: by * BLOCK + 14 + r('y') * (BLOCK - 28 - h), w, h});
			}
		}
	}
	return out;
})();

const CityMap: React.FC<{
	width: number;
	height: number;
	zoom: number; // screen px per world unit
	time: number; // frame clock shared by the phone and full-screen versions
	uiScale: number; // size of pin and phone icons
	pinDrop?: number;
	labels?: number; // override for street names and the business chip
	business: string;
}> = ({width, height, zoom, time, uiScale, pinDrop = 1, labels, business}) => {
	const cx = width / 2;
	const cy = height / 2;
	const toScreen = ([x, y]: Pt): Pt => [cx + x * zoom, cy + y * zoom];
	const lines = Array.from({length: (EXTENT / BLOCK) * 2 + 1}, (_, i) => -EXTENT + i * BLOCK);
	const far = interpolate(zoom, [0.04, 0.5], [1, 0], clamp); // 1 when zoomed out
	const iconAlpha = interpolate(zoom, [0.18, 0.5], [0, 1], clamp);
	const pulse = (time % 24) / 24;
	const labelAlpha = labels ?? interpolate(zoom, [0.9, 1.8], [0, 1], clamp);

	return (
		<svg width={width} height={height} style={{display: 'block', background: '#182038'}}>
			<defs>
				<radialGradient id={`cityGlow-${width}`}>
					<stop offset="0%" stopColor={HEAT.orange} stopOpacity={0.9} />
					<stop offset="22%" stopColor={HEAT.yellow} stopOpacity={0.6} />
					<stop offset="45%" stopColor={HEAT.teal} stopOpacity={0.35} />
					<stop offset="70%" stopColor={HEAT.blue} stopOpacity={0.22} />
					<stop offset="100%" stopColor={HEAT.blue} stopOpacity={0} />
				</radialGradient>
			</defs>
			<g transform={`translate(${cx} ${cy}) scale(${zoom})`}>
				<rect x={-EXTENT} y={-EXTENT} width={EXTENT * 2} height={EXTENT * 2} fill="#1b2340" />
				{/* river and parks */}
				<path
					d={`M ${-EXTENT} ${-900} C ${-1800} ${-400}, ${-900} ${-1500}, 0 ${-1080} S ${1800} ${-300}, ${EXTENT} ${-1300}`}
					stroke="#1a3a66"
					strokeWidth={150}
					fill="none"
				/>
				<rect x={2 * BLOCK} y={1 * BLOCK} width={2 * BLOCK} height={BLOCK} fill="#1b3b3a" />
				<rect x={-6 * BLOCK} y={3 * BLOCK} width={BLOCK * 3} height={BLOCK * 2} fill="#1b3b3a" />
				<rect x={-3 * BLOCK} y={-6 * BLOCK} width={BLOCK} height={BLOCK * 2} fill="#1b3b3a" />
				{BUILDINGS.map((b, i) => (
					<rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill="#232d4f" />
				))}
				{/* streets */}
				{lines.map((v) => {
					const major = Math.round(v / BLOCK) % 5 === 0;
					const w = major ? 24 : 11;
					const col = major ? '#4a5a86' : '#34416a';
					return (
						<g key={v}>
							<line x1={v} y1={-EXTENT} x2={v} y2={EXTENT} stroke={col} strokeWidth={w} />
							<line x1={-EXTENT} y1={v} x2={EXTENT} y2={v} stroke={col} strokeWidth={w} />
						</g>
					);
				})}
				<line x1={-EXTENT} y1={EXTENT * 0.7} x2={EXTENT} y2={-EXTENT * 0.55} stroke="#56679a" strokeWidth={30} />
				{/* street names */}
				<g opacity={labelAlpha} fontFamily={MONO} fontSize={11} fill="#a9b6d8" letterSpacing={2}>
					<text x={-BLOCK * 2.6} y={4}>MAIN ST</text>
					<text x={-4} y={BLOCK * 1.3} transform={`rotate(90 -4 ${BLOCK * 1.3})`}>5TH AVE</text>
				</g>
				{/* searcher trails */}
				{AGENTS.map((a, i) => {
					const d = (time * a.speed + a.phase * a.len) % a.len;
					const pts = [0, 50, 100, 150, 200, 260].map((k) => posAt(a, d - k));
					return (
						<polyline
							key={i}
							points={pts.map((q) => q.join(',')).join(' ')}
							fill="none"
							stroke={HEAT.cyan}
							strokeOpacity={0.85}
							strokeWidth={3 * Math.max(uiScale, 0.5)}
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
						/>
					);
				})}
				{/* city glow that the globe's heat bloom takes over */}
				<circle cx={0} cy={0} r={EXTENT * 0.9} fill={`url(#cityGlow-${width})`} opacity={far * 0.9} />
			</g>

			{/* phone icons, constant screen size */}
			{AGENTS.map((a, i) => {
				const d = (time * a.speed + a.phase * a.len) % a.len;
				const [x, y] = toScreen(posAt(a, d));
				if (x < -40 || y < -40 || x > width + 40 || y > height + 40) return null;
				const s = uiScale;
				return (
					<g key={i} transform={`translate(${x} ${y})`}>
						<circle r={3 * Math.max(s, 0.6)} fill={HEAT.cyan} opacity={1 - iconAlpha} />
						<g opacity={iconAlpha}>
							<circle r={24 * s} fill={HEAT.cyan} opacity={0.25} />
							<rect x={-9 * s} y={-15 * s} width={18 * s} height={30 * s} rx={4 * s} fill={C.paper} />
							<rect x={-6.5 * s} y={-11 * s} width={13 * s} height={20 * s} rx={2 * s} fill={C.red} />
							<rect x={-3 * s} y={11.5 * s} width={6 * s} height={1.6 * s} rx={0.8 * s} fill="#9a948a" />
						</g>
					</g>
				);
			})}

			{/* business pin */}
			<g transform={`translate(${cx} ${cy})`}>
				<circle r={(18 + 60 * pulse) * uiScale} fill="none" stroke={C.red} strokeWidth={3 * uiScale} opacity={(1 - pulse) * pinDrop} />
				<g transform={`translate(0 ${-(1 - pinDrop) * 90 * uiScale}) scale(${uiScale * 1.6})`} opacity={Math.min(1, pinDrop * 3)}>
					<path d="M0 0 C-14 -18 -16 -24 -16 -30 A16 16 0 1 1 16 -30 C16 -24 14 -18 0 0 Z" fill={C.red} stroke={C.paper} strokeWidth={1.5} />
					<rect x="-5" y="-35" width="10" height="10" fill={C.paper} />
				</g>
				<g opacity={labelAlpha * pinDrop} transform={`translate(${34 * uiScale} ${-70 * uiScale}) scale(${uiScale})`}>
					<rect x={0} y={-22} width={190} height={40} rx={20} fill={C.paper} />
					<text x={20} y={5} fontFamily={FONT} fontWeight={700} fontSize={19} fill={C.ink}>
						{business}
					</text>
				</g>
			</g>
		</svg>
	);
};

const PhoneInHand: React.FC<{query: string; business: string; push: number; mapTime: number}> = ({
	query,
	business,
	push,
	mapTime,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const rise = spring({frame, fps, config: {damping: 16, stiffness: 70}});
	const text = typed(query, frame, 6, 22);
	const map = useSpring(18);
	const pinDrop = spring({frame: frame - 22, fps, config: {damping: 9, stiffness: 180}});
	const card = spring({frame: frame - 26, fps, config: {damping: 14, stiffness: 120}});
	const tap = interpolate(frame, [34, 46], [0, 1], clamp);
	const press = frame >= 34 && frame < 40 ? 0.94 : 1;

	const skin = 'url(#handSkin)';
	return (
		<div
			style={{
				position: 'absolute',
				left: 1060,
				top: 70,
				width: 700,
				height: 1000,
				transform: `translateY(${(1 - rise) * 700}px) rotate(${interpolate(rise, [0, 1], [-12, -5]) * (1 - push)}deg)`,
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
					<div style={{display: 'flex', justifyContent: 'space-between', height: 40, boxSizing: 'border-box', padding: '20px 30px 0', fontSize: 17, lineHeight: '20px', fontWeight: 600, color: C.ink}}>
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
						{frame < 26 ? <Cursor height={24} /> : null}
					</div>

					{/* map */}
					<div
						style={{
							margin: '18px 20px 0',
							width: PHONE_MAP_W,
							height: PHONE_MAP_H,
							borderRadius: 22 * (1 - push),
							overflow: 'hidden',
							opacity: map,
							transform: `translateY(${(1 - map) * 20}px)`,
						}}
					>
						<CityMap
							width={PHONE_MAP_W}
							height={PHONE_MAP_H}
							zoom={CITY_ZOOM / PUSH_SCALE}
							time={mapTime}
							uiScale={UI_BOOST / PUSH_SCALE}
							pinDrop={pinDrop}
							labels={push}
							business={business}
						/>
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

const FinaleScene: React.FC<{p: SeoAnimationProps}> = ({p}) => {
	const frame = useCurrentFrame();
	const heatOpacity = interpolate(frame, [62, 70], [1, 0], clamp);
	const flash = interpolate(frame, [58, 63, 70], [0, 0.95, 0], clamp);

	// 1. Push into the phone's map until it fills the frame.
	const push = interpolate(frame, [FIN.pushStart, FIN.pushEnd], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const pushScale = Math.pow(PUSH_SCALE, push);
	// Map centre inside the phone stage, in screen pixels, once the phone is upright.
	const MAP_X = 1060 + 150 + 14 + 20 + PHONE_MAP_W / 2;
	const MAP_Y = 70 + 80 + 14 + 146 + PHONE_MAP_H / 2;
	const captionOut = interpolate(frame, [FIN.pushStart - 4, FIN.pushStart + 8], [1, 0], clamp);
	const phoneVisible = frame < FIN.pushEnd;

	// 2. Pull back over the city, accelerating.
	const out = interpolate(frame, [FIN.pushEnd, FIN.cityOutEnd], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
	const cityZoom = CITY_ZOOM * Math.pow(0.012, out);
	const cityUi = interpolate(frame, [FIN.pushEnd, FIN.pushEnd + 20], [UI_BOOST, 1], {...clamp, easing: Easing.out(Easing.quad)});
	const cityOpacity = interpolate(frame, [FIN.globeFrom - 2, FIN.cityOutEnd - 4], [1, 0], clamp);
	// Soft circular edge so the shrinking city melts into the globe's heat bloom.
	const cityMaskR = EXTENT * cityZoom * 0.95;

	// 3. Globe takes over, starting zoomed in on the same spot.
	const globeZoom = interpolate(frame, [FIN.globeFrom, FIN.globeSettled], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
	const globeIn = interpolate(frame, [FIN.globeFrom, FIN.globeFrom + 12], [0, 1], clamp);

	return (
		<AbsoluteFill>
			{frame < 72 ? (
				<AbsoluteFill style={{opacity: heatOpacity}}>
					<HeatmapZoom zoomStart={44} zoomEnd={66} />
				</AbsoluteFill>
			) : null}

			{frame >= FIN.globeFrom ? (
				<Sequence from={FIN.globeFrom} layout="none">
					<AbsoluteFill style={{opacity: globeIn}}>
						<DataGlobe cx={WIDTH / 2} cy={HEIGHT / 2} r={450} zoom={globeZoom} />
					</AbsoluteFill>
				</Sequence>
			) : null}

			{frame >= FIN.pushEnd && cityOpacity > 0 ? (
				<AbsoluteFill
					style={{
						opacity: cityOpacity,
						maskImage: `radial-gradient(circle ${cityMaskR}px at 50% 50%, black 35%, transparent 100%)`,
						WebkitMaskImage: `radial-gradient(circle ${cityMaskR}px at 50% 50%, black 35%, transparent 100%)`,
					}}
				>
					<CityMap width={WIDTH} height={HEIGHT} zoom={cityZoom} time={frame} uiScale={cityUi} business={p.businessName} />
				</AbsoluteFill>
			) : null}

			{phoneVisible ? (
				<Sequence from={FIN.phoneFrom} layout="none">
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
								opacity: captionOut,
							}}
						/>
						<div style={{position: 'absolute', left: 140, top: 330, width: 820, opacity: captionOut}}>
							<Eyebrow delay={4}>Near me, right now</Eyebrow>
							<Words text={p.dataHeadline} start={6} stagger={4} accent="search." style={{...headline, marginTop: 34}} />
						</div>
						<AbsoluteFill
							style={{
								transformOrigin: `${MAP_X}px ${MAP_Y}px`,
								transform: `translate(${(WIDTH / 2 - MAP_X) * push}px, ${(HEIGHT / 2 - MAP_Y) * push}px) scale(${pushScale})`,
							}}
						>
							<PhoneInHand query={p.phoneQuery} business={p.businessName} push={push} mapTime={frame} />
						</AbsoluteFill>
					</AbsoluteFill>
				</Sequence>
			) : null}

			{/* soft vignette so the CTA sits on the globe */}
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 55%, rgba(12,18,38,0.45) 100%)',
					opacity: interpolate(frame, [FIN.ctaFrom, FIN.ctaFrom + 12], [0, 1], clamp),
				}}
			/>

			<Sequence from={FIN.ctaFrom} layout="none">
				<CtaScene text={p.ctaHeadline} accent={p.ctaAccent} button={p.ctaButton} url={p.url} />
			</Sequence>

			<AbsoluteFill style={{background: '#fff4ea', opacity: flash, mixBlendMode: 'screen'}} />
		</AbsoluteFill>
	);
};

/* ------------------------------------------------------------------ */
/* Data globe: dot-matrix Earth with heat, arcs and orbit HUD          */
/* ------------------------------------------------------------------ */

// Coarse continent outlines as [lon, lat]. Only used to decide where dots go.
const LAND: Pt[][] = [
	[[-168, 66], [-156, 71], [-130, 70], [-95, 72], [-80, 73], [-62, 60], [-55, 52], [-66, 45], [-76, 35], [-81, 25], [-97, 26], [-97, 20], [-87, 21], [-83, 10], [-79, 8], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-124, 48], [-135, 58], [-150, 60], [-165, 60]],
	[[-55, 60], [-44, 60], [-20, 70], [-20, 82], [-60, 82], [-72, 77]],
	[[-80, 8], [-60, 10], [-50, 0], [-35, -5], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-72, -30], [-70, -18], [-81, -5]],
	[[-10, 36], [-9, 43], [-2, 48], [-5, 58], [5, 62], [15, 70], [30, 71], [40, 66], [40, 45], [28, 41], [20, 40], [12, 38], [3, 43]],
	[[-5, 50], [1, 51], [-2, 56], [-5, 58], [-6, 54]],
	[[-17, 15], [-17, 21], [-10, 30], [-6, 36], [10, 37], [32, 31], [35, 28], [43, 12], [51, 11], [40, -3], [40, -16], [32, -28], [20, -35], [15, -25], [12, -5], [8, 5], [-8, 4]],
	[[36, 30], [35, 28], [43, 12], [52, 16], [58, 22], [50, 30]],
	[[40, 66], [70, 73], [110, 77], [140, 72], [180, 68], [180, 64], [160, 60], [142, 52], [135, 43], [122, 40], [122, 30], [110, 20], [106, 10], [100, 13], [98, 8], [92, 22], [80, 15], [77, 8], [72, 20], [57, 25], [50, 30], [48, 30], [36, 36], [28, 41], [40, 45]],
	[[130, 31], [141, 36], [142, 44], [140, 41]],
	[[114, -22], [122, -18], [131, -12], [137, -12], [142, -11], [146, -19], [153, -28], [150, -37], [141, -38], [131, -32], [115, -34]],
];

const inPoly = (x: number, y: number, poly: Pt[]) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [xi, yi] = poly[i];
		const [xj, yj] = poly[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
};

type City = {name: string; lon: number; lat: number; heat: number};
const CITIES: City[] = [
	{name: 'BOISE', lon: -116.2, lat: 43.6, heat: 1},
	{name: 'LOS ANGELES', lon: -118.2, lat: 34.1, heat: 0.9},
	{name: 'NEW YORK', lon: -74, lat: 40.7, heat: 0.95},
	{name: 'CHICAGO', lon: -87.6, lat: 41.9, heat: 0.6},
	{name: 'DALLAS', lon: -96.8, lat: 32.8, heat: 0.6},
	{name: 'MIAMI', lon: -80.2, lat: 25.8, heat: 0.55},
	{name: 'SÃO PAULO', lon: -46.6, lat: -23.5, heat: 0.7},
	{name: 'LONDON', lon: -0.1, lat: 51.5, heat: 0.85},
	{name: 'LAGOS', lon: 3.4, lat: 6.5, heat: 0.5},
	{name: 'DUBAI', lon: 55.3, lat: 25.2, heat: 0.6},
];
const ARCS: [number, number][] = [
	[0, 1], [0, 2], [0, 4], [2, 7], [1, 3], [5, 6], [2, 5], [7, 8], [7, 9], [3, 2], [4, 6], [0, 7],
];

const RAD = Math.PI / 180;
type V3 = [number, number, number];
const toVec = (lon: number, lat: number): V3 => [
	Math.cos(lat * RAD) * Math.cos(lon * RAD),
	Math.cos(lat * RAD) * Math.sin(lon * RAD),
	Math.sin(lat * RAD),
];

const slerp = (a: V3, b: V3, t: number): V3 => {
	const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
	const om = Math.acos(dot);
	if (om < 1e-6) return a;
	const s0 = Math.sin((1 - t) * om) / Math.sin(om);
	const s1 = Math.sin(t * om) / Math.sin(om);
	return [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
};

// zoom 0 = close over the home city (hand-off from the street map), 1 = whole globe.
const GLOBE_CLOSE = 14;
const HOME = CITIES[0];

const DataGlobe: React.FC<{cx: number; cy: number; r: number; zoom: number}> = ({cx, cy, r, zoom}) => {
	const frame = useCurrentFrame();
	const enter = 1;
	const R = r * Math.pow(GLOBE_CLOSE, 1 - zoom);

	// Camera: start locked on the home city, then spin east while slowly tilting.
	// Stay locked on the home city until the street map has dissolved, then drift.
	const aim = Math.pow(zoom, 3);
	const lon0 = HOME.lon + (-88 + frame * 0.42 - HOME.lon) * aim;
	const lat0 = HOME.lat + (24 - frame * 0.04 - HOME.lat) * aim;
	const sl = Math.sin(lat0 * RAD);
	const cl = Math.cos(lat0 * RAD);

	// Project a unit vector (optionally lifted) to screen, with depth.
	const project = (v: V3, lift = 1) => {
		const lon = Math.atan2(v[1], v[0]) - lon0 * RAD;
		const lat = Math.asin(Math.max(-1, Math.min(1, v[2])));
		const x = Math.cos(lat) * Math.sin(lon);
		const y = cl * Math.sin(lat) - sl * Math.cos(lat) * Math.cos(lon);
		const z = sl * Math.sin(lat) + cl * Math.cos(lat) * Math.cos(lon);
		return {x: cx + x * R * lift, y: cy - y * R * lift, z, lift};
	};
	const visible = (p: {x: number; y: number; z: number}) =>
		p.z > 0 || Math.hypot(p.x - cx, p.y - cy) > R + 1;

	const dots = useMemo(() => {
		const out: {v: V3; heat: number; phase: number}[] = [];
		const cityVecs = CITIES.map((c) => toVec(c.lon, c.lat));
		for (let lat = -58; lat <= 80; lat += 2.1) {
			const step = 2.1 / Math.max(0.2, Math.cos(lat * RAD));
			for (let lon = -180; lon < 180; lon += step) {
				if (!LAND.some((poly) => inPoly(lon, lat, poly))) continue;
				const v = toVec(lon, lat);
				let heat = 0;
				cityVecs.forEach((c, i) => {
					const d = Math.acos(Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2])) / RAD;
					heat = Math.max(heat, CITIES[i].heat * Math.exp(-(d * d) / (2 * 5.5 * 5.5)));
				});
				out.push({v, heat, phase: random(`g-${lon}-${lat}`) * Math.PI * 2});
			}
		}
		return out;
	}, []);

	const graticule = useMemo(() => {
		const lines: V3[][] = [];
		for (let lon = -180; lon < 180; lon += 20) {
			lines.push(Array.from({length: 61}, (_, i) => toVec(lon, -90 + i * 3)));
		}
		for (let lat = -60; lat <= 60; lat += 20) {
			lines.push(Array.from({length: 121}, (_, i) => toVec(-180 + i * 3, lat)));
		}
		return lines;
	}, []);

	const pathFor = (pts: ReturnType<typeof project>[]) => {
		let d = '';
		let pen = false;
		for (const q of pts) {
			if (visible(q)) {
				d += `${pen ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)} `;
				pen = true;
			} else pen = false;
		}
		return d;
	};

	const orbit = frame * 1.6;

	return (
		<svg width={WIDTH} height={HEIGHT} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
			<defs>
				<radialGradient id="globeBody" cx="42%" cy="36%" r="70%">
					<stop offset="0%" stopColor="#2a3d78" />
					<stop offset="60%" stopColor="#18244d" />
					<stop offset="100%" stopColor="#0f1734" />
				</radialGradient>
				<radialGradient id="globeAtmo" cx="50%" cy="50%" r="50%">
					<stop offset="80%" stopColor={HEAT.cyan} stopOpacity={0} />
					<stop offset="82.5%" stopColor={HEAT.cyan} stopOpacity={0.55} />
					<stop offset="86%" stopColor={HEAT.blue} stopOpacity={0.25} />
					<stop offset="100%" stopColor={HEAT.blue} stopOpacity={0} />
				</radialGradient>
				<radialGradient id="heatBloom">
					<stop offset="0%" stopColor={HEAT.hot} stopOpacity={0.85} />
					<stop offset="18%" stopColor={HEAT.orange} stopOpacity={0.7} />
					<stop offset="38%" stopColor={HEAT.yellow} stopOpacity={0.45} />
					<stop offset="60%" stopColor={HEAT.teal} stopOpacity={0.25} />
					<stop offset="80%" stopColor={HEAT.blue} stopOpacity={0.15} />
					<stop offset="100%" stopColor={HEAT.blue} stopOpacity={0} />
				</radialGradient>
				<radialGradient id="globeSpec" cx="35%" cy="28%" r="45%">
					<stop offset="0%" stopColor={C.paper} stopOpacity={0.08} />
					<stop offset="100%" stopColor={C.paper} stopOpacity={0} />
				</radialGradient>
				<filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
					<feGaussianBlur stdDeviation="4" result="b" />
					<feMerge>
						<feMergeNode in="b" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<g opacity={enter}>
				{/* atmosphere and body */}
				<circle cx={cx} cy={cy} r={R * 1.22} fill="url(#globeAtmo)" />
				<circle cx={cx} cy={cy} r={R} fill="url(#globeBody)" />
				<circle cx={cx} cy={cy} r={R} fill="none" stroke={HEAT.cyan} strokeOpacity={0.5} strokeWidth={1.5} />

				<circle cx={cx} cy={cy} r={R} fill="url(#globeSpec)" />

				{/* heat blooms under the dots */}
				{CITIES.map((c) => {
					const q = project(toVec(c.lon, c.lat));
					if (q.z <= 0) return null;
					const size = R * (0.1 + 0.1 * c.heat) * (1 + 0.08 * Math.sin(frame / 6 + c.lon));
					const ang = Math.atan2(q.y - cy, q.x - cx) / RAD;
					return (
						<ellipse
							key={c.name}
							cx={q.x}
							cy={q.y}
							rx={size}
							ry={size * Math.max(0.25, q.z)}
							transform={`rotate(${ang + 90} ${q.x} ${q.y})`}
							fill="url(#heatBloom)"
							opacity={Math.min(1, q.z * 1.6) * c.heat}
							style={{mixBlendMode: 'screen'}}
						/>
					);
				})}

				{/* graticule */}
				{graticule.map((line, i) => (
					<path key={i} d={pathFor(line.map((v) => project(v)))} fill="none" stroke={C.paper} strokeOpacity={0.06} strokeWidth={1} />
				))}

				{/* land dots, heat-coloured */}
				{dots.map((d, i) => {
					const q = project(d.v);
					if (q.z <= 0.02 || q.x < -20 || q.y < -20 || q.x > WIDTH + 20 || q.y > HEIGHT + 20) return null;
					const h = d.heat * (0.8 + 0.2 * Math.sin(frame / 5 + d.phase));
					const color = heatColor(Math.min(1, 0.22 + h * 0.8));
					return (
						<circle
							key={i}
							cx={q.x}
							cy={q.y}
							r={(2.1 + 1.8 * h) * (0.55 + 0.45 * q.z)}
							fill={color}
							opacity={(0.6 + 0.4 * h) * (0.35 + 0.65 * q.z)}
						/>
					);
				})}

				{/* great-circle tracking arcs */}
				{ARCS.map(([a, b], i) => {
					const start = 14 + i * 4;
					const t = interpolate(frame, [start, start + 26], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
					if (t <= 0) return null;
					const va = toVec(CITIES[a].lon, CITIES[a].lat);
					const vb = toVec(CITIES[b].lon, CITIES[b].lat);
					const span = Math.acos(Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
					const N = 48;
					const pts = Array.from({length: N + 1}, (_, k) => {
						const u = k / N;
						return project(slerp(va, vb, u), 1 + 0.35 * span * Math.sin(Math.PI * u));
					});
					const upto = Math.max(1, Math.round(t * N));
					const drawn = pts.slice(0, upto + 1);
					const head = drawn[drawn.length - 1];
					const comet = drawn.slice(Math.max(0, drawn.length - 9));
					const land = interpolate(frame, [start + 26, start + 46], [0, 1], clamp);
					const end = pts[N];
					return (
						<g key={i}>
							<path d={pathFor(drawn)} fill="none" stroke={C.amber} strokeOpacity={0.35} strokeWidth={1.6} />
							{t < 1 ? (
								<>
									<path d={pathFor(comet)} fill="none" stroke="#fff1d6" strokeWidth={3} strokeLinecap="round" filter="url(#arcGlow)" />
									{visible(head) ? <circle cx={head.x} cy={head.y} r={4.5} fill="#fff1d6" filter="url(#arcGlow)" /> : null}
								</>
							) : null}
							{land > 0 && land < 1 && visible(end) ? (
								<circle cx={end.x} cy={end.y} r={4 + 26 * land} fill="none" stroke={C.red} strokeWidth={2} opacity={1 - land} />
							) : null}
						</g>
					);
				})}

				{/* city beacons and labels */}
				{CITIES.map((c, i) => {
					const q = project(toVec(c.lon, c.lat));
					if (q.z < 0.15) return null;
					const pulse = ((frame + i * 7) % 30) / 30;
					// Labels stay out of the headline band so they never collide with the copy.
					const showLabel = c.heat >= 0.85 && (q.y < 250 || q.y > 540);
					return (
						<g key={c.name} opacity={Math.min(1, (q.z - 0.15) * 4)}>
							<circle cx={q.x} cy={q.y} r={5 + 18 * pulse} fill="none" stroke={C.amber} strokeWidth={1.5} opacity={0.8 * (1 - pulse)} />
							<circle cx={q.x} cy={q.y} r={4} fill="#fff1d6" />
							{showLabel ? (
								<g>
									<line x1={q.x} y1={q.y} x2={q.x + 26} y2={q.y - 26} stroke={C.paper} strokeOpacity={0.5} />
									<text x={q.x + 30} y={q.y - 30} fill={C.paper} fillOpacity={0.75} fontFamily={MONO} fontSize={15} letterSpacing="0.14em">
										{c.name}
									</text>
								</g>
							) : null}
						</g>
					);
				})}

				{/* orbit HUD: tilted rings with tick marks and a tracking satellite */}
				<g transform={`translate(${cx} ${cy}) rotate(-18)`}>
					<ellipse rx={R * 1.32} ry={R * 0.34} fill="none" stroke={C.paper} strokeOpacity={0.14} strokeDasharray="2 10" strokeDashoffset={-orbit * 2} />
					<ellipse rx={R * 1.48} ry={R * 0.42} fill="none" stroke={C.red} strokeOpacity={0.22} strokeDasharray="60 18 4 18" strokeDashoffset={orbit * 3} />
					{(() => {
						const a = (orbit * 1.4 * RAD) % (Math.PI * 2);
						const sx = Math.cos(a) * R * 1.32;
						const sy = Math.sin(a) * R * 0.34;
						const front = Math.sin(a) > 0;
						return (
							<g opacity={front ? 1 : 0.25}>
								<circle cx={sx} cy={sy} r={14} fill="none" stroke={C.amber} strokeOpacity={0.6} />
								<circle cx={sx} cy={sy} r={5} fill={C.amber} />
							</g>
						);
					})()}
				</g>
				<circle
					cx={cx}
					cy={cy}
					r={R * 1.1}
					fill="none"
					stroke={C.paper}
					strokeOpacity={0.12}
					strokeWidth={10}
					strokeDasharray="1 11"
					transform={`rotate(${frame * 0.5} ${cx} ${cy})`}
				/>
			</g>
		</svg>
	);
};

/* ------------------------------------------------------------------ */
/* Scene 5 - Call to action                                            */
/* ------------------------------------------------------------------ */

const CtaScene: React.FC<{text: string; accent: string; button: string; url: string}> = ({text, accent, button, url}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const mark = useSpring(0, {damping: 16, stiffness: 120});
	const btn = spring({frame: frame - 16, fps, config: {damping: 11, stiffness: 140}});
	const urlIn = useSpring(24);
	const breathe = 1 + 0.035 * Math.sin((frame - 16) / 5) * interpolate(frame, [24, 32], [0, 1], clamp);

	// cursor glides in and clicks at CLICK
	const CLICK = 42;
	const glide = interpolate(frame, [26, CLICK], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
	const pressed = frame >= CLICK && frame < CLICK + 5;
	const burst = interpolate(frame, [CLICK, CLICK + 20], [0, 1], clamp);

	const BTN_Y = 760;

	return (
		<AbsoluteFill>
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 60% 55% at 50% 62%, rgba(47,107,255,${0.26 + 0.08 * Math.sin(frame / 6)}), transparent 70%), radial-gradient(ellipse 35% 25% at 50% 72%, rgba(255,138,61,0.18), transparent 70%)`,
				}}
			/>

			{/* scrim keeps the headline and button readable over the globe */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 48% 16% at 50% 36%, rgba(16,22,44,0.72), transparent 100%), radial-gradient(ellipse 30% 10% at 50% 70%, rgba(16,22,44,0.5), transparent 100%)',
				}}
			/>

			{/* sonar rings behind the button */}
			{[0, 1, 2].map((k) => {
				const t = (((frame - 22 + k * 14) % 42) + 42) % 42 / 42;
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
							opacity: frame > 22 ? (1 - t) * 0.55 : 0,
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
				start={2}
				stagger={2}
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
						left: interpolate((((frame - 26) % 40) + 40) % 40, [0, 40], [-200, 860]),
						background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
						transform: 'skewX(-20deg)',
						opacity: frame > 26 ? 1 : 0,
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
					opacity: interpolate(frame, [24, 30], [0, 1], clamp),
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
		<AbsoluteFill style={{background: BG.base, fontFamily: FONT}}>
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

			<Sequence from={SCENES.finale.from} durationInFrames={SCENES.finale.duration} name="4-5 Phone to globe to CTA">
				<SceneFade duration={SCENES.finale.duration}>
					<FinaleScene p={p} />
				</SceneFade>
			</Sequence>

			<Grain />
		</AbsoluteFill>
	);
};
