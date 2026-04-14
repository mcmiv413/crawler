import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/game-store.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { useAutoWalk } from './hooks/useAutoWalk.js';
import { useBreakpoint } from './hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from './config/ui-config.js';
import { StartScreen } from './components/StartScreen.js';
import { TownPhase } from './components/TownPhase.js';
import { DungeonPhase } from './components/DungeonPhase.js';
import { GameOverPhase } from './components/GameOverPhase.js';
import { NemesisRisenScreen } from './components/NemesisRisenScreen.js';
import { NemesisSlainScreen } from './components/NemesisSlainScreen.js';
import { DeathNotificationModal } from './components/DeathNotificationModal.js';
import { QuestAssignedScreen } from './components/QuestAssignedScreen.js';
import { MobileNav } from './components/MobileNav.js';
import { CharacterScreen } from './components/CharacterScreen.js';
import { InventoryScreen } from './components/InventoryScreen.js';
import { CombatLogView } from './components/CombatLogView.js';
import * as api from './api/client.js';

type Screen = 'main' | 'inventory' | 'character' | 'log';

function renderPanel(
  panelType: Screen,
  view: any,
  combatLog: readonly { text: string; type: string }[],
  sendCommand: (command: unknown) => Promise<void>,
  isMobile: boolean,
  onClosePanel?: () => void,
) {
  const panelStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    width: isMobile ? '100%' : '300px',
    borderLeft: isMobile ? 'none' : '1px solid #333',
  };

  if (panelType === 'inventory') {
    return (
      <div key="inventory" style={panelStyle}>
        <InventoryScreen inventory={view.inventory} phase={view.phase} sendCommand={sendCommand} onClose={onClosePanel || (() => {})} gold={view.player.gold} />
      </div>
    );
  }

  if (panelType === 'character') {
    return (
      <div key="character" style={panelStyle}>
        <CharacterScreen player={view.player} activeQuests={view.activeQuests} />
      </div>
    );
  }

  if (panelType === 'log') {
    return (
      <div key="log" style={panelStyle}>
        <CombatLogView entries={combatLog} debugMode={view.debugMode} />
      </div>
    );
  }

  return null;
}

export function App() {
  const { view, gameId, combatLog, loading, error, createGame, sendCommand, clearError, restoreSession, resetGame } = useGameStore();
  const { isMobile } = useBreakpoint();
  const [playerName, setPlayerName] = useState('Adventurer');
  const [npcDialogue, setNpcDialogue] = useState<{ name: string; text: string } | null>(null);
  const [talkingTo, setTalkingTo] = useState<string | null>(null);
  const [useSprites, setUseSprites] = useState(import.meta.env.VITE_ASCII_MODE !== 'true');
  const [openPanels, setOpenPanels] = useState<Set<Screen>>(new Set());
  const [shownRisenNemesisIds, setShownRisenNemesisIds] = useState<Set<string>>(new Set());
  const [shownSlainNemesisIds, setShownSlainNemesisIds] = useState<Set<string>>(new Set());
  const [shownQuestIds, setShownQuestIds] = useState<Set<string>>(new Set());
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!gameId) {
      restoreSession().finally(() => setSessionChecked(true));
    } else {
      setSessionChecked(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNavClick(screen: Screen) {
    if (screen === 'main') {
      setOpenPanels(new Set());
      return;
    }
    setOpenPanels(prev => {
      const next = new Set(prev);
      if (next.has(screen)) {
        next.delete(screen);
      } else {
        if (isMobile) next.clear();
        next.add(screen);
      }
      return next;
    });
  }

  useKeyboard(() => {
    // Keyboard shortcuts for future use
  });
  useAutoWalk();

  async function talkToNpc(npcId: string, npcName: string) {
    if (!gameId) return;
    setTalkingTo(npcId);
    try {
      // Update game state (quest assignment, disposition bump)
      await sendCommand({ type: 'TOWN_ACTION', action: 'talk_npc', targetId: npcId });
      // Fetch AI dialogue text
      const result = await api.fetchNpcDialogue(gameId, npcId);
      setNpcDialogue({ name: result.npcName, text: result.dialogue });
    } catch {
      setNpcDialogue({ name: npcName, text: '...' });
    } finally {
      setTalkingTo(null);
    }
  }

  // No game: show start screen
  if (!gameId || !view) {
    if (!sessionChecked) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', color: '#666', background: '#111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Restoring session…
        </div>
      );
    }
    return <StartScreen playerName={playerName} setPlayerName={setPlayerName} onCreateGame={createGame} loading={loading} error={error} />;
  }

  // Game over phase (full screen, no mobile nav)
  if (view.phase === 'game_over') {
    return <GameOverPhase view={view} combatLog={combatLog} error={error} onNewGame={() => { resetGame(); createGame(undefined, view.player.name); }} />;
  }

  // Nemesis risen screen (when a new nemesis is created from your death)
  if (view.phase === 'town' && view.town?.runSummaryStats?.nemesisPromoted) {
    // Extract nemesis name from combat log entry: "A nemesis rises: <Name> <Title> — ..."
    const nemesisRisenEntry = combatLog.find(e => e.text.includes('A nemesis rises:'));
    let promotedNemesis: typeof view.town.nemeses[0] | undefined;

    if (nemesisRisenEntry) {
      // Parse: "A nemesis rises: <Name> <Title> — a new threat lurks in the dungeon!"
      const match = nemesisRisenEntry.text.match(/A nemesis rises: (.+?) —/);
      const nameWithTitle = match?.[1];
      if (nameWithTitle) {
        // Find nemesis by matching the beginning of name
        promotedNemesis = view.town.nemeses.find(n => nameWithTitle.includes(n.name));
      }
    }

    // Fallback to last active if we can't parse the log
    const activeNemesis = promotedNemesis || view.town.nemeses.filter(n => n.isActive).pop();

    if (activeNemesis && !shownRisenNemesisIds.has(activeNemesis.id)) {
      return (
        <NemesisRisenScreen
          view={view}
          nemesis={activeNemesis}
          deathContext={view.deathContext}
          onDismiss={() => {
            setShownRisenNemesisIds(new Set([...shownRisenNemesisIds, activeNemesis.id]));
          }}
        />
      );
    }
  }

  // Nemesis slain screen (when you defeat a nemesis in dungeon)
  if (view.phase === 'town' && view.town?.slainNemeses) {
    const unshownSlain = view.town.slainNemeses.find(n => !shownSlainNemesisIds.has(n.id));
    if (unshownSlain) {
      return (
        <NemesisSlainScreen
          view={view}
          nemesis={unshownSlain}
          onDismiss={() => {
            setShownSlainNemesisIds(new Set([...shownSlainNemesisIds, unshownSlain.id]));
          }}
        />
      );
    }
  }

  // Death notification modal (when you die without nemesis promotion)
  if (view.phase === 'town' && view.deathContext && !view.town?.runSummaryStats?.nemesisPromoted) {
    const notShownDeaths = view.deathContext ? 1 : 0; // Track if we've shown this death
    if (notShownDeaths > 0 && !shownRisenNemesisIds.has('death-notification')) {
      return (
        <DeathNotificationModal
          deathContext={view.deathContext}
          onDismiss={() => {
            setShownRisenNemesisIds(new Set([...shownRisenNemesisIds, 'death-notification']));
          }}
        />
      );
    }
  }

  // Quest assigned screen (when an NPC gives you a quest)
  if (view.phase === 'town') {
    // Find the most recent QUEST_ASSIGNED log entry that hasn't been shown
    const newQuestLog = combatLog.find(
      entry =>
        entry.text.startsWith('New quest:') &&
        view.activeQuests.some(
          q =>
            (entry.text.includes(q.title) || q.id) &&
            !shownQuestIds.has(q.id),
        ),
    );

    if (newQuestLog && view.activeQuests.length > 0) {
      // Find the quest that matches this log entry
      const newQuest = view.activeQuests.find(
        q => !shownQuestIds.has(q.id) && newQuestLog.text.includes(q.title),
      ) || view.activeQuests.find(q => !shownQuestIds.has(q.id));

      if (newQuest) {
        const giverNpc = view.town?.npcs.find(n => n.id === newQuest.giverNpcId);
        return (
          <QuestAssignedScreen
            view={view}
            questTitle={newQuest.title}
            questDescription={newQuest.description}
            rewardGold={newQuest.rewardGold}
            giverNpc={giverNpc}
            onDismiss={() => {
              setShownQuestIds(new Set([...shownQuestIds, newQuest.id]));
            }}
          />
        );
      }
    }
  }

  // Unified layout for mobile and desktop
  const visiblePanels: Screen[] = (['inventory', 'character', 'log'] as Screen[]).filter(p => openPanels.has(p));
  const activeNavScreen: Screen = isMobile && openPanels.size > 0 ? ([...openPanels][0] ?? 'main') : 'main';
  // On mobile, show either main content or panels (switching), not both
  const showMainContent = !isMobile || visiblePanels.length === 0;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
        {showMainContent && (
          <>
            {view.phase === 'town' ? (
              <TownPhase
                view={view}
                combatLog={combatLog}
                loading={loading}
                error={error}
                sendCommand={sendCommand}
                talkToNpc={talkToNpc}
                npcDialogue={npcDialogue}
                setNpcDialogue={setNpcDialogue}
                talkingTo={talkingTo}
              />
            ) : (
              <DungeonPhase
                view={view}
                combatLog={combatLog}
                loading={loading}
                error={error}
                sendCommand={sendCommand}
                useSprites={useSprites}
                setUseSprites={setUseSprites}
              />
            )}
          </>
        )}
        {!isMobile && visiblePanels.map(p => renderPanel(p, view, combatLog, sendCommand, isMobile, () => handleNavClick(p)))}
        {isMobile && visiblePanels.length > 0 && visiblePanels.map(p => renderPanel(p, view, combatLog, sendCommand, isMobile, () => handleNavClick(p)))}
      </div>
      <MobileNav activeScreen={activeNavScreen} onScreenChange={handleNavClick} phase={view.phase as 'town' | 'dungeon'} onNewGame={resetGame} />
    </div>
  );
}
