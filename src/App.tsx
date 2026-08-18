import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FeaturedCategories } from './components/FeaturedCategories';
import { ToolDashboard } from './components/ToolDashboard';
import { ToolDetailModal } from './components/ToolDetailModal';
import { SearchDialog } from './components/common/SearchDialog';
import { Footer } from './components/Footer';
import { Language, Theme } from './types';

const VALID_LANGUAGES: Language[] = ['en', 'fa', 'zh', 'es', 'fr', 'de'];
const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];

function getValidInitialLang(): Language {
  try {
    const saved = localStorage.getItem('bioai_lang');
    if (saved && VALID_LANGUAGES.includes(saved as Language)) {
      return saved as Language;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'en';
}

function getValidInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('bioai_theme');
    if (saved && VALID_THEMES.includes(saved as Theme)) {
      return saved as Theme;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light';
}

function getValidInitialFavorites(): string[] {
  const defaultFavorites = ['dna_analyzer', 'primer_designer', 'protein_analyzer'];
  try {
    const saved = localStorage.getItem('bioai_favorites');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        return parsed;
      }
    }
  } catch {
    // Fallback on error
  }
  return defaultFavorites;
}

export default function App() {
  const [lang, setLang] = useState<Language>(getValidInitialLang);
  const [theme, setTheme] = useState<Theme>(getValidInitialTheme);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>(getValidInitialFavorites);


  // Handle language switch HTML attributes
  useEffect(() => {
    try {
      localStorage.setItem('bioai_lang', lang);
    } catch {
      // Storage unavailable
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  // Handle Theme mode
  useEffect(() => {
    try {
      localStorage.setItem('bioai_theme', theme);
    } catch {
      // Storage unavailable
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'system') {
        if (mediaQuery.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  // Handle Ctrl+K shortcut for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save favorites to localStorage
  const handleToggleFavorite = (toolId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId];
      try {
        localStorage.setItem('bioai_favorites', JSON.stringify(updated));
      } catch {
        // Storage unavailable
      }
      return updated;
    });
  };

  const handleNavigateHome = () => {
    setActiveToolId(null);
    setSelectedCategory('all');
    setShowFavoritesOnly(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreClick = () => {
    const el = document.getElementById('tools');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBrowseCategoriesClick = () => {
    const el = document.getElementById('categories');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F3FAF7] text-[#12312B] font-sans antialiased selection:bg-[#14B8A6]/20 selection:text-[#0F766E] dark:bg-slate-950 dark:text-slate-100">
      {/* Navigation Header */}
      <Navbar
        currentLang={lang}
        onLanguageChange={setLang}
        currentTheme={theme}
        onThemeChange={setTheme}
        onOpenSearch={() => setSearchOpen(true)}
        favoriteCount={favorites.length}
        onOpenFavorites={() => {
          setShowFavoritesOnly(true);
          setSelectedCategory('all');
          handleExploreClick();
        }}
        onNavigateHome={handleNavigateHome}
        onSelectCategory={(catId) => {
          setShowFavoritesOnly(false);
          setSelectedCategory(catId);
          handleExploreClick();
        }}
      />

      {/* Hero Section */}
      <Hero
        lang={lang}
        onExploreClick={handleExploreClick}
        onBrowseCategoriesClick={handleBrowseCategoriesClick}
      />

      {/* Featured Categories Grid */}
      <FeaturedCategories
        lang={lang}
        onSelectCategory={(catId) => {
          setShowFavoritesOnly(false);
          setSelectedCategory(catId);
          handleExploreClick();
        }}
      />

      {/* Main Tools Dashboard */}
      <ToolDashboard
        lang={lang}
        selectedCategory={selectedCategory}
        onSelectCategory={(catId) => {
          setShowFavoritesOnly(false);
          setSelectedCategory(catId);
        }}
        showFavoritesOnly={showFavoritesOnly}
        onClearFavoritesFilter={() => setShowFavoritesOnly(false)}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onOpenTool={(toolId) => setActiveToolId(toolId)}
      />

      {/* Tool Detail View Modal */}
      {activeToolId && (
        <ToolDetailModal
          toolId={activeToolId}
          lang={lang}
          onClose={() => setActiveToolId(null)}
          isFavorite={favorites.includes(activeToolId)}
          onToggleFavorite={() => handleToggleFavorite(activeToolId)}
        />
      )}

      {/* Global Interactive Search Modal */}
      <SearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectTool={(toolId) => setActiveToolId(toolId)}
        lang={lang}
      />

      {/* Footer */}
      <Footer lang={lang} onLanguageChange={setLang} />
    </div>
  );
}
