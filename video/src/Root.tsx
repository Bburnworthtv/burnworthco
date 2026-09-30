import React from 'react';
import {Composition} from 'remotion';
import {
	BG_LOOP_FRAMES,
	DURATION_IN_FRAMES,
	FPS,
	HEIGHT,
	SeoAnimation,
	SeoBackgroundLoop,
	WIDTH,
	defaultSeoProps,
} from './SeoAnimation';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			{/* Explainer with its own copy and end card. */}
			<Composition
				id="SeoHero"
				component={SeoAnimation}
				durationInFrames={DURATION_IN_FRAMES}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={defaultSeoProps}
			/>
			{/* Seamless 12-second loop with no copy, for behind the site's HTML hero. */}
			<Composition
				id="SeoHeroBackground"
				component={SeoBackgroundLoop}
				durationInFrames={BG_LOOP_FRAMES}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
			/>
		</>
	);
};
