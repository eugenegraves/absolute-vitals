import { Island } from '@absolutejs/absolute/react';
import { Head } from '../components/Head';

type AnalyzePageProps = {
	cssPath?: string;
};

export const AnalyzePage = ({ cssPath }: AnalyzePageProps) => (
	<html lang="en">
		<Head cssPath={cssPath} title="AbsoluteVitals · Analyze" />
		<body>
			<header className="app-header">
				<div className="container app-header__inner">
					<div>
						<h1 className="app-title">AbsoluteVitals</h1>
						<p className="app-subtitle">URL Analyzer · synthetic probe</p>
					</div>
					<nav className="app-nav">
						<a href="/dashboard">Dashboard</a>
						<a className="is-active" href="/analyze">
							Analyze
						</a>
						<a href="/status">Status</a>
						<a href="/swagger">API</a>
						<Island component="ThemeToggle" framework="react" props={{}} />
					</nav>
				</div>
			</header>

			<main className="main">
				<div className="container stack stack--xl">
					<section className="hero">
						<h1 className="hero__title">Analyze any URL</h1>
						<p className="hero__subtitle">
							Run a synthetic probe to measure TTFB, response time, status,
							body size, content encoding, and basic SEO meta tags. The URL
							is automatically tracked and you'll be taken to the dashboard
							to see its metrics.
						</p>
					</section>

					<Island component="AnalyzeForm" framework="react" props={{}} />
				</div>
			</main>
		</body>
	</html>
);
