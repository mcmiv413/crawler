import React, { useCallback, useEffect, useState } from 'react';
import type {
  DismissibleNotice,
  GameView,
  QuestAssignedNotice,
} from '@dungeon/presenter';

import { fetchNpcDialogue } from './api/client.js';
import { CombatLogView } from './components/CombatLogView.js';
import { CharacterScreen } from './components/CharacterScreen.js';
import { DeathNotificationModal } from './components/DeathNotificationModal.js';
import { DungeonPhase } from './components/DungeonPhase.js';
import { GameOverPhase } from './components/GameOverPhase.js';
import { InventoryScreen } from './components/InventoryScreen.js';
import { MobileNav } from './components/MobileNav.js';
import { ProgressNoticeModal } from './components/ProgressNoticeModal.js';
import { QuestAssignedScreen } from './components/QuestAssignedScreen.js';
import { StartScreen } from './components/StartScreen.js';
import { TownPhase } from './components/TownPhase.js';
import { useAutoWalk } from './hooks/useAutoWalk.js';
import { useBreakpoint } from './hooks/useBreakpoint.js';
import { useDismissedNotices } from './hooks/useDismissedNotices.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { useGameStore } from './store/game-store.js';

type Screen = 'main' | 'inventory' | 'character' | 'log';
type AppStoreState = ReturnType<typeof useGameStore.getState>;
type NpcDialogueState = { name: string; text: string } | null;

function renderPanel(
  panelType: Screen,
  view: GameView,
  combatLog: AppStoreState['combatLog'],
  sendCommand: AppStoreState['sendCommand'],
  isMobile: boolean,
  onClosePanel?: () => void,
): React.ReactNode {
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
    const inventoryNotice =
      view.notice?.kind === 'EQUIP_BLOCKED' ? view.notice : undefined;
    return (
      <div key="inventory" style={panelStyle}>
        <InventoryScreen
          inventory={view.inventory}
          phase={view.phase}
          sendCommand={sendCommand}
          onClose={onClosePanel ?? (() => {})}
          gold={view.player.gold}
          notice={inventoryNotice}
        />
      </div>
    );
  }

  if (panelType === 'character') {
    return (
      <div key="character" style={panelStyle}>
        <CharacterScreen
          player={view.player}
          activeQuests={view.activeQuests}
          sendCommand={sendCommand}
        />
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

interface StartStateProps {
  readonly sessionChecked: boolean;
  readonly playerName: string;
  readonly setPlayerName: React.Dispatch<React.SetStateAction<string>>;
  readonly createGame: AppStoreState['createGame'];
  readonly loading: boolean;
  readonly error: string | null;
}

function renderStartState({
  sessionChecked,
  playerName,
  setPlayerName,
  createGame,
  loading,
  error,
}: StartStateProps): React.ReactNode {
  if (!sessionChecked) {
    return (
      <div
        style={{
          padding: 20,
          fontFamily: 'monospace',
          color: '#666',
          background: '#111',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Restoring session…
      </div>
    );
  }

  return (
    <StartScreen
      playerName={playerName}
      setPlayerName={setPlayerName}
      onCreateGame={createGame}
      loading={loading}
      error={error}
    />
  );
}

interface PhaseContentProps {
  readonly view: GameView;
  readonly combatLog: AppStoreState['combatLog'];
  readonly loading: boolean;
  readonly error: string | null;
  readonly sendCommand: AppStoreState['sendCommand'];
  readonly talkToNpc: (npcId: string, npcName: string) => Promise<void>;
  readonly npcDialogue: NpcDialogueState;
  readonly setNpcDialogue: React.Dispatch<React.SetStateAction<NpcDialogueState>>;
  readonly talkingTo: string | null;
  readonly useSprites: boolean;
  readonly setUseSprites: React.Dispatch<React.SetStateAction<boolean>>;
}

function renderPhaseContent({
  view,
  combatLog,
  loading,
  error,
  sendCommand,
  talkToNpc,
  npcDialogue,
  setNpcDialogue,
  talkingTo,
  useSprites,
  setUseSprites,
}: PhaseContentProps): React.ReactNode {
  return view.phase === 'town' ? (
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
  );
}

interface VisiblePanelsProps {
  readonly visiblePanels: readonly Screen[];
  readonly view: GameView;
  readonly combatLog: AppStoreState['combatLog'];
  readonly sendCommand: AppStoreState['sendCommand'];
  readonly isMobile: boolean;
  readonly handleNavClick: (screen: Screen) => void;
}

function renderVisiblePanels({
  visiblePanels,
  view,
  combatLog,
  sendCommand,
  isMobile,
  handleNavClick,
}: VisiblePanelsProps): React.ReactNode {
  const panelNodes = visiblePanels.map(panel =>
    renderPanel(
      panel,
      view,
      combatLog,
      sendCommand,
      isMobile,
      () => handleNavClick(panel),
    ),
  );

  if (!isMobile) {
    return panelNodes;
  }

  return visiblePanels.length > 0 ? panelNodes : null;
}

function renderDeathTransitionOverlay(): React.ReactNode {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(139, 0, 0, 0.5)',
        zIndex: 9999,
        pointerEvents: 'auto',
        animation: 'fadeIn 0.5s ease-in',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ccc',
        fontSize: '18px',
        fontFamily: 'monospace',
      }}
      onKeyDown={event => event.preventDefault()}
      onKeyUp={event => event.preventDefault()}
      tabIndex={0}
    >
      You died...
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

interface GameShellProps extends PhaseContentProps {
  readonly openPanels: ReadonlySet<Screen>;
  readonly isMobile: boolean;
  readonly handleNavClick: (screen: Screen) => void;
  readonly deathTransitioning: boolean;
  readonly resetGame: AppStoreState['resetGame'];
  readonly visibleProgressNotice: DismissibleNotice | null;
  readonly dismissProgressNotice: () => void;
}

function GameShell({
  view,
  combatLog,
  loading,
  error,
  sendCommand,
  talkToNpc,
  npcDialogue,
  setNpcDialogue,
  talkingTo,
  useSprites,
  setUseSprites,
  openPanels,
  isMobile,
  handleNavClick,
  deathTransitioning,
  resetGame,
  visibleProgressNotice,
  dismissProgressNotice,
}: GameShellProps): React.ReactNode {
  const visiblePanels = (['inventory', 'character', 'log'] as const).filter(
    panel => openPanels.has(panel),
  );
  const navPhase = view.phase === 'town' ? 'town' : 'dungeon';

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#111',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        {!isMobile || visiblePanels.length === 0
          ? renderPhaseContent({
              view,
              combatLog,
              loading,
              error,
              sendCommand,
              talkToNpc,
              npcDialogue,
              setNpcDialogue,
              talkingTo,
              useSprites,
              setUseSprites,
            })
          : null}
        {renderVisiblePanels({
          visiblePanels,
          view,
          combatLog,
          sendCommand,
          isMobile,
          handleNavClick,
        })}
      </div>
      <MobileNav
        openScreens={openPanels}
        onScreenChange={handleNavClick}
        phase={navPhase}
        onNewGame={resetGame}
      />
      {deathTransitioning ? renderDeathTransitionOverlay() : null}
      {visibleProgressNotice !== null ? (
        <ProgressNoticeModal
          notice={visibleProgressNotice}
          onDismiss={dismissProgressNotice}
        />
      ) : null}
    </div>
  );
}

interface PriorityScreenProps {
  readonly view: GameView;
  readonly combatLog: AppStoreState['combatLog'];
  readonly error: string | null;
  readonly createGame: AppStoreState['createGame'];
  readonly resetGame: AppStoreState['resetGame'];
  readonly visibleDeathContext: GameView['deathContext'];
  readonly dismissDeathNotice: () => void;
  readonly visibleQuestNotice: QuestAssignedNotice | null;
  readonly dismissQuestNotice: () => void;
}

function renderPriorityScreen({
  view,
  combatLog,
  error,
  createGame,
  resetGame,
  visibleDeathContext,
  dismissDeathNotice,
  visibleQuestNotice,
  dismissQuestNotice,
}: PriorityScreenProps): React.ReactNode {
  if (view.phase === 'game_over') {
    return (
      <GameOverPhase
        view={view}
        combatLog={combatLog}
        error={error}
        onNewGame={() => {
          resetGame();
          createGame(undefined, view.player.name);
        }}
      />
    );
  }

  if (visibleDeathContext !== null) {
    return (
      <DeathNotificationModal
        deathContext={visibleDeathContext}
        onDismiss={dismissDeathNotice}
      />
    );
  }

  if (view.phase === 'town' && visibleQuestNotice !== null) {
    const giverNpc = view.town?.npcs.find(
      npc => npc.id === visibleQuestNotice.giverNpcId,
    );
    return (
      <QuestAssignedScreen
        view={view}
        questTitle={visibleQuestNotice.questTitle}
        questDescription={visibleQuestNotice.questDescription}
        rewardGold={visibleQuestNotice.rewardGold}
        giverNpc={giverNpc}
        onDismiss={dismissQuestNotice}
      />
    );
  }

  return null;
}

function useSessionRestoreGate(
  gameId: string | null,
  restoreSession: AppStoreState['restoreSession'],
): boolean {
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!gameId) {
      restoreSession().finally(() => setSessionChecked(true));
      return;
    }

    setSessionChecked(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return sessionChecked;
}

function usePanelNavigation(isMobile: boolean): {
  readonly openPanels: ReadonlySet<Screen>;
  readonly handleNavClick: (screen: Screen) => void;
} {
  const [openPanels, setOpenPanels] = useState<Set<Screen>>(() => new Set());

  const handleNavClick = useCallback((screen: Screen): void => {
    if (screen === 'main') {
      setOpenPanels(new Set());
      return;
    }

    setOpenPanels(previous => {
      const next = new Set(previous);
      if (next.has(screen)) {
        next.delete(screen);
      } else {
        if (isMobile) {
          next.clear();
        }
        next.add(screen);
      }
      return next;
    });
  }, [isMobile]);

  return { openPanels, handleNavClick };
}

export function App(): React.ReactNode {
  const {
    view,
    gameId,
    combatLog,
    loading,
    error,
    deathTransitioning,
    createGame,
    sendCommand,
    restoreSession,
    resetGame,
  } = useGameStore();
  const { isMobile } = useBreakpoint();
  const [playerName, setPlayerName] = useState('Adventurer');
  const [npcDialogue, setNpcDialogue] = useState<NpcDialogueState>(null);
  const [talkingTo, setTalkingTo] = useState<string | null>(null);
  const [useSprites, setUseSprites] = useState(
    import.meta.env.VITE_ASCII_MODE !== 'true',
  );
  const sessionChecked = useSessionRestoreGate(gameId, restoreSession);
  const { openPanels, handleNavClick } = usePanelNavigation(isMobile);
  const {
    visibleDeathContext,
    visibleQuestNotice,
    visibleProgressNotice,
    dismissDeathNotice,
    dismissQuestNotice,
    dismissProgressNotice,
  } = useDismissedNotices({
    gameId,
    phase: view?.phase ?? null,
    deathContext: view?.deathContext ?? null,
    deathTransitioning,
    notices: view?.notices ?? [],
  });

  useKeyboard(() => {
    // Keyboard shortcuts for future use
  });
  useAutoWalk();

  async function talkToNpc(npcId: string, npcName: string): Promise<void> {
    if (!gameId) {
      return;
    }

    setTalkingTo(npcId);
    try {
      await sendCommand({
        type: 'TOWN_ACTION',
        action: 'talk_npc',
        targetId: npcId,
      });
      const result = await fetchNpcDialogue(gameId, npcId);
      setNpcDialogue({ name: result.npcName, text: result.dialogue });
    } catch {
      setNpcDialogue({ name: npcName, text: '...' });
    } finally {
      setTalkingTo(null);
    }
  }

  if (!gameId || view === null) {
    return renderStartState({
      sessionChecked,
      playerName,
      setPlayerName,
      createGame,
      loading,
      error,
    });
  }

  const priorityScreen = renderPriorityScreen({
    view,
    combatLog,
    error,
    createGame,
    resetGame,
    visibleDeathContext,
    dismissDeathNotice,
    visibleQuestNotice,
    dismissQuestNotice,
  });
  if (priorityScreen !== null) {
    return priorityScreen;
  }

  return (
    <GameShell
      view={view}
      combatLog={combatLog}
      loading={loading}
      error={error}
      sendCommand={sendCommand}
      talkToNpc={talkToNpc}
      npcDialogue={npcDialogue}
      setNpcDialogue={setNpcDialogue}
      talkingTo={talkingTo}
      useSprites={useSprites}
      setUseSprites={setUseSprites}
      openPanels={openPanels}
      isMobile={isMobile}
      handleNavClick={handleNavClick}
      deathTransitioning={deathTransitioning}
      resetGame={resetGame}
      visibleProgressNotice={visibleProgressNotice}
      dismissProgressNotice={dismissProgressNotice}
    />
  );
}
