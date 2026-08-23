import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BarChart3, CalendarDays, Flag, Heart, Home, ListOrdered, Moon, Sun, Trophy, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AboutPage, CalendarPage, HomePage, PointsPage, PrivacyPage, RankPage, ResultsPage, StandingsPage, StatisticsPage, SupportProjectPage } from './pages'
import logo from '../ChatGPT Image Aug 23, 2026 at 11_58_28 AM.png'
import './index.css'
import './logo.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } } })
const navGroups = [
  { label: 'Overview', links: [['/', 'Home', Home]] },
  { label: 'Season', links: [['/calendar', 'Calendar', CalendarDays], ['/results', 'Results', Flag]] },
  { label: 'Championship', links: [['/standings', 'Standings', Trophy], ['/points', 'Points', BarChart3], ['/rank', 'Rank', ListOrdered]] },
  { label: 'Analysis', links: [['/statistics', 'Statistics', BarChart3]] },
  { label: 'Project', links: [['/about', 'About', User], ['/support', 'Support this project', Heart]] },
] as const

function Shell() {
  const [dark, setDark] = useState(() => localStorage.getItem('motoracedata-theme') !== 'light' && (localStorage.getItem('motoracedata-theme') === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches))
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('motoracedata-theme', dark ? 'dark' : 'light') }, [dark])
  return <div className="app-shell"><aside><NavLink to="/" className="brand"><img src={logo} alt="MotoRaceData logo" /><strong>MotoRaceData<small>Race intelligence</small></strong></NavLink><nav>{navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.links.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon />{label}</NavLink>)}</div>)}</nav><button className="theme" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}{dark ? 'Light mode' : 'Dark mode'}</button></aside><main><Routes><Route path="/" element={<HomePage />} /><Route path="/rank" element={<RankPage />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/results" element={<ResultsPage />} /><Route path="/results-summary" element={<Navigate to="/results?view=summary" replace />} /><Route path="/results/race" element={<Navigate to="/results" replace />} /><Route path="/results/year" element={<Navigate to="/results?view=summary&summary=year" replace />} /><Route path="/standings" element={<StandingsPage />} /><Route path="/points" element={<PointsPage />} /><Route path="/points/race" element={<Navigate to="/points" replace />} /><Route path="/points/year" element={<Navigate to="/points?view=year" replace />} /><Route path="/statistics" element={<StatisticsPage />} /><Route path="/circuit" element={<Navigate to="/statistics" replace />} /><Route path="/about" element={<AboutPage />} /><Route path="/support" element={<SupportProjectPage />} /><Route path="/privacy" element={<PrivacyPage />} /></Routes><footer>Unofficial fan project · Data sourced from the public MotoGP results service · <NavLink to="/privacy">Privacy</NavLink></footer></main></div>
}

export default function App() { return <QueryClientProvider client={queryClient}><HashRouter><Shell /></HashRouter></QueryClientProvider> }
