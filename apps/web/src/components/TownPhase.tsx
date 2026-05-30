import React, { useState } from 'react';
import type { GameView, NpcView, FactionView } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import {
  colors,
  FONT_STACK,
  btnStyle,
  btnPrimaryStyle,
  btnContinueStyle,
  btnStashStyle,
  npcBtnTalk,
  npcBtnShop,
  npcBtnHeal,
  npcBtnTavern,
  npcBtnEnchant,
} from '../styles.js';
import { PlayerHud } from './PlayerHud.js';
import { EnchanterPanel } from './EnchanterPanel.js';
import { RunSummaryPanel } from './RunSummaryPanel.js';
import { ShopPanel } from './ShopPanel.js';
import { FactionDetailModal } from './FactionDetailModal.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { InfoCard, PanelHeader, SectionLabel } from './ui/index.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';

type TownPanel = 'main' | 'shop' | 'tavern' | 'enchanter' | 'elder';

interface TownPhaseProps {
  view: GameView;
  combatLog: readonly { text: string; type: string }[];
  loading: boolean;
  error: string | null;
  sendCommand: (command: unknown) => Promise<void>;
  talkToNpc: (npcId: string, npcName: string) => void;
  npcDialogue: { name: string; text: string } | null;
  setNpcDialogue: (d: { name: string; text: string } | null) => void;
  talkingTo: string | null;
}

// ─── DawnLike sprite for each NPC role ────────────────────────────────────
const NPC_ROLE_SPRITES: Record<string, string> = {
  shopkeeper: 'shopkeeper',
  healer: 'healer',
  informant: 'ordinary human',
  blacksmith: 'guard',
  elder: 'aligned priest',
  enchanter: 'wizard',
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
}

function leaderStateText(faction: FactionView): string {
  if (faction.leader.state === 'emerged' && faction.leader.name && faction.leader.title) {
    return `${faction.leader.name}, ${faction.leader.title}`;
  }
  if (faction.leader.state === 'slain') {
    return 'Leader slain';
  }
  return 'No active leader';
}

// ─── NPC card component ────────────────────────────────────────────────────
function NpcCard({
  npc,
  playerHealth,
  playerMaxHealth,
  playerGold,
  loading,
  talkingTo,
  onTalk,
  onShop,
  onHeal,
  onTavern,
  onEnchanter,
  onElder,
}: {
  npc: NpcView;
  playerHealth: number;
  playerMaxHealth: number;
  playerGold: number;
  loading: boolean;
  talkingTo: string | null;
  onTalk: () => void;
  onShop: () => void;
  onHeal: () => void;
  onTavern: () => void;
  onEnchanter: () => void;
  onElder: () => void;
}) {
  const healCost = Math.max(0, playerMaxHealth - playerHealth);
  const canHeal = playerHealth < playerMaxHealth && playerGold >= healCost;
  const spriteName = NPC_ROLE_SPRITES[npc.role];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '2px',
        marginBottom: 3,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          background: colors.inset,
          border: `1px solid ${colors.border2}`,
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {spriteName ? (
          <ItemSpriteIcon spriteName={spriteName} size={24} />
        ) : (
          <span style={{ fontSize: 11, color: colors.muted }}>
            {npc.role.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {npc.name}
        </div>
        <div style={{ fontSize: 10, color: colors.muted, textTransform: 'capitalize' }}>
          {npc.role}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        <button onClick={onTalk} style={npcBtnTalk} disabled={loading || talkingTo !== null}>
          {talkingTo === npc.id ? '...' : 'Talk'}
        </button>

        {npc.role === 'shopkeeper' && (
          <button onClick={onShop} style={npcBtnShop} disabled={loading}>
            Shop →
          </button>
        )}

        {npc.role === 'healer' && (
          <button
            onClick={onHeal}
            style={{
              ...npcBtnHeal,
              color: canHeal ? '#6ac870' : colors.muted,
              opacity: canHeal ? 1 : 0.5,
            }}
            disabled={loading || !canHeal}
            title={
              playerHealth >= playerMaxHealth
                ? 'Already at full health'
                : `Heal for ${healCost}g`
            }
          >
            Heal ({healCost}g)
          </button>
        )}

        {npc.role === 'informant' && (
          <button onClick={onTavern} style={npcBtnTavern} disabled={loading}>
            Tavern →
          </button>
        )}

        {npc.role === 'enchanter' && (
          <button onClick={onEnchanter} style={npcBtnEnchant} disabled={loading}>
            Enchant →
          </button>
        )}

        {npc.role === 'elder' && (
          <button onClick={onElder} style={npcBtnTalk} disabled={loading}>
            Study →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tavern sub-panel ──────────────────────────────────────────────────────
function TavernPanel({ view, onOpenFactionDetails }: { view: GameView; onOpenFactionDetails: () => void }) {
  return (
    <div style={{ fontFamily: FONT_STACK, color: colors.text }}>
      <h3
        style={{
          color: colors.purple,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          margin: 0,
          marginBottom: 10,
          fontFamily: FONT_STACK,
        }}
      >
        Tavern &amp; Town News
      </h3>

      {view.town && (
        <div style={{ marginBottom: 10 }}>
          <SectionLabel label="Town Atmosphere" />
          <div style={{ color: colors.label, fontStyle: 'italic', fontSize: 11 }}>
            {view.town.atmosphereDescription}
          </div>
          <div style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
            Prosperity: {view.town.prosperity} · Fear: {view.town.fear} · Corruption:{' '}
            {view.town.corruption}
          </div>
        </div>
      )}

      {view.town?.rumors && view.town.rumors.length > 0 && (
        <InfoCard marginBottom={10}>
          <SectionLabel label="Rumors" />
          {view.town.rumors.map((rumor: string, i: number) => (
            <div
              key={rumor}
              style={{
                fontSize: 11,
                color: colors.label,
                fontStyle: 'italic',
                padding: '2px 0',
                borderBottom:
                  i < view.town!.rumors.length - 1 ? `1px solid ${colors.border2}` : 'none',
              }}
            >
              &ldquo;{rumor}&rdquo;
            </div>
          ))}
        </InfoCard>
      )}

      {view.activeQuests.length > 0 && (
        <InfoCard borderColor={colors.lime} marginBottom={10}>
          <SectionLabel label="Quest Log" color={colors.lime} />
          {view.activeQuests.map(
            (q: {
              id: string;
              title: string;
              description: string;
              status: string;
              rewardGold: number;
            }) => {
              const isComplete = q.status === 'complete';
              const isFailed = q.status === 'failed';
              const statusColor = isComplete
                ? colors.lime
                : isFailed
                ? colors.blood
                : colors.steel;
              return (
                <div
                  key={q.id}
                  style={{
                    fontSize: 11,
                    color: statusColor,
                    padding: '3px 0',
                    opacity: isFailed ? 0.6 : 1,
                  }}
                >
                  <strong>
                    {isComplete ? '[done] ' : ''}
                    {q.title}
                  </strong>
                  <span style={{ color: statusColor, marginLeft: 4 }}>[{q.status}]</span>
                  <div style={{ color: colors.muted, fontSize: 10 }}>{q.description}</div>
                  <div style={{ color: colors.gold, fontSize: 10 }}>Reward: {q.rewardGold}g</div>
                </div>
              );
            },
          )}
        </InfoCard>
      )}

      {view.town && (
        <InfoCard marginBottom={10}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <SectionLabel label="Factions" color={colors.lime} />
            {view.town.factions.length > 0 && (
              <button
                onClick={onOpenFactionDetails}
                style={{
                  padding: '3px 8px',
                  background: colors.inset,
                  color: colors.lime,
                  border: `1px solid ${colors.border2}`,
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: FONT_STACK,
                }}
              >
                Inspect →
              </button>
            )}
          </div>
          {view.town.factions.length === 0 ? (
            <div style={{ fontSize: 11, color: colors.muted }}>
              No faction activity reported.
            </div>
          ) : (
            view.town.factions.map((faction: FactionView) => (
              <div
                key={faction.id}
                style={{ fontSize: 11, color: colors.text, padding: '4px 0', borderBottom: `1px solid ${colors.border2}` }}
              >
                <div style={{ fontWeight: 600 }}>
                  {faction.name} — Power {faction.power}/100 · {titleCase(faction.powerBand)}
                </div>
                <div style={{ color: colors.muted, fontSize: 10 }}>
                  {titleCase(faction.status)} · {leaderStateText(faction)}
                </div>
                <div style={{ color: colors.label, fontSize: 10, marginTop: 2 }}>{faction.townEffectText}</div>
              </div>
            ))
          )}
        </InfoCard>
      )}

      {view.town && (
        <InfoCard borderColor={colors.steel} marginBottom={10}>
          <SectionLabel label="Dungeon Ogre" color={colors.steel} />
          <div style={{ color: colors.text, fontSize: 11 }}>{view.town.ogreProgress.summaryText}</div>
          {view.town.ogreProgress.eligibleSpawnDepths.length > 0 ? (
            <div style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
              Eligible depths: {view.town.ogreProgress.eligibleSpawnDepths.join(', ')} · Selected depth:{' '}
              {view.town.ogreProgress.selectedSpawnDepth ?? 'unknown'}
            </div>
          ) : null}
        </InfoCard>
      )}
    </div>
  );
}

// ─── Sub-panel wrapper (Shop / Tavern / Enchanter) ─────────────────────────
function SubPanel({
  onBack,
  children,
  isMobile,
}: {
  onBack: () => void;
  children: React.ReactNode;
  isMobile: boolean;
}) {
  return (
    <div
      data-testid="town-subpanel"
      style={{
        padding: 8,
        paddingBottom: isMobile ? TAB_BAR_HEIGHT : 8,
        fontFamily: FONT_STACK,
        color: colors.text,
        background: colors.panel,
        flex: 1,
        overflow: 'auto',
      }}
    >
      <button onClick={onBack} style={{ ...btnStyle, marginBottom: 10, width: '100%' }}>
        &larr; Back to Town
      </button>
      {children}
    </div>
  );
}

function ElderPanel({
  view,
  loading,
  sendCommand,
}: {
  view: GameView;
  loading: boolean;
  sendCommand: (command: unknown) => Promise<void>;
}) {
  const spells = view.town?.studyableSpells ?? [];
  return (
    <div style={{ fontFamily: FONT_STACK, color: colors.text }}>
      <h3 style={{ color: colors.purple, fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 10 }}>
        Ring Study
      </h3>
      <div style={{ marginTop: 4, marginBottom: 10, color: colors.gold, fontSize: 11 }}>
        Gold: {view.player.gold}g
      </div>
      {spells.length === 0 ? (
        <div style={{ color: colors.muted, fontSize: 11 }}>No spells available to study yet.</div>
      ) : (
        spells.map((spell: typeof spells[number]) => {
          const disabled = loading || spell.canStudy === false;
          const priceLabel = spell.canStudy ? 'Study' : `Need ${spell.goldCost}g`;
          const schoolProgressLabel = spell.nextSchoolLevelXp === null
            ? 'Max tier'
            : `${spell.currentSchoolXp} / ${spell.nextSchoolLevelXp} XP`;

          return (
            <div
              key={spell.spellId}
              style={{
                padding: '6px 8px',
                marginBottom: 8,
                border: `1px solid ${spell.affordable ? 'rgba(138,120,200,0.4)' : colors.border2}`,
                background: spell.affordable ? 'rgba(138,120,200,0.08)' : colors.card,
                boxShadow: spell.affordable ? 'inset 2px 0 0 rgba(138,120,200,0.3)' : 'none',
                opacity: spell.affordable ? 1 : 0.65,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{spell.name}</div>
                  <div style={{ fontSize: 10, color: colors.label, marginTop: 3 }}>{spell.description}</div>
                  <div style={{ fontSize: 10, color: colors.muted, marginTop: 6 }}>
                    {titleCase(spell.schools[0] ?? 'magic')} Lv {spell.currentSchoolLevel} · {schoolProgressLabel} · Range {spell.range} · {spell.goldCost}g
                  </div>
                </div>
                <button
                  style={{ ...btnStyle, margin: 0, minWidth: 84, fontSize: 10 }}
                  disabled={disabled}
                  onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'study_spell', spellId: spell.spellId })}
                  title={priceLabel}
                >
                  {priceLabel}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export function TownPhase({
  view,
  loading,
  error,
  sendCommand,
  talkToNpc,
  npcDialogue,
  setNpcDialogue,
  talkingTo,
}: TownPhaseProps) {
  const [townPanel, setTownPanel] = useState<TownPanel>('main');
  const [showFactionsModal, setShowFactionsModal] = useState(false);
  const { isMobile } = useBreakpoint();

  if (townPanel === 'shop') {
    return (
      <SubPanel onBack={() => setTownPanel('main')} isMobile={isMobile}>
        {view.town?.shop ? (
          <ShopPanel view={view} loading={loading} sendCommand={sendCommand} />
        ) : null}
      </SubPanel>
    );
  }

  if (townPanel === 'tavern') {
    return (
      <>
        <SubPanel onBack={() => setTownPanel('main')} isMobile={isMobile}>
          <TavernPanel view={view} onOpenFactionDetails={() => setShowFactionsModal(true)} />
        </SubPanel>
        {showFactionsModal && view.town?.factions && (
          <FactionDetailModal factions={view.town.factions} onClose={() => setShowFactionsModal(false)} />
        )}
      </>
    );
  }

  if (townPanel === 'enchanter') {
    return (
      <SubPanel onBack={() => setTownPanel('main')} isMobile={isMobile}>
        {view.town ? (
          <EnchanterPanel
            town={view.town}
            inventory={view.inventory}
            playerGold={view.player.gold}
          />
        ) : null}
      </SubPanel>
    );
  }

  if (townPanel === 'elder') {
    return (
      <SubPanel onBack={() => setTownPanel('main')} isMobile={isMobile}>
        <ElderPanel view={view} loading={loading} sendCommand={sendCommand} />
      </SubPanel>
    );
  }

  return (
    <div
      style={{
        fontFamily: FONT_STACK,
        color: colors.text,
        background: colors.panel,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Header — fixed */}
      <PanelHeader title="Town" />

      {/* Top section: player stats and action buttons — fixed */}
      <div style={{ flexShrink: 0, padding: 8, borderBottom: `1px solid ${colors.border}` }}>
        <PlayerHud player={view.player} compact />

        <div style={{ display: 'flex', flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            onClick={() => {
              setNpcDialogue(null);
              sendCommand({ type: 'TOWN_ACTION', action: 'enter_dungeon' });
            }}
            style={{ ...btnPrimaryStyle, flex: 1, minWidth: 80 }}
            disabled={loading}
          >
            Enter Dungeon
          </button>

          {view.town?.lastRetreatFloor && view.town.lastRetreatFloor > 1 && (
            <button
              onClick={() => {
                setNpcDialogue(null);
                sendCommand({
                  type: 'TOWN_ACTION',
                  action: 'enter_dungeon',
                  startDepth: view.town!.lastRetreatFloor,
                });
              }}
              style={{ ...btnContinueStyle, flex: 1, minWidth: 80 }}
              disabled={loading}
              title="Continue from where you left off"
            >
              Continue — Floor {view.town.lastRetreatFloor}
            </button>
          )}

          {view.deathStashFloor && view.deathStashFloor > 0 && (
            <button
              onClick={() => {
                setNpcDialogue(null);
                sendCommand({
                  type: 'TOWN_ACTION',
                  action: 'enter_dungeon',
                  startDepth: view.deathStashFloor,
                });
              }}
              style={{ ...btnStashStyle, flex: 1, minWidth: 80 }}
              disabled={loading}
              title="Return to retrieve your lost items"
            >
              Recover Stash — Floor {view.deathStashFloor}
            </button>
          )}
        </div>
      </div>

      {/* NPC section — fixed height, cards shown */}
      {view.town?.npcs && view.town.npcs.length > 0 && (
        <div style={{ flexShrink: 0, padding: '0 8px', borderBottom: `1px solid ${colors.border}` }}>
          <SectionLabel label="NPCs" />
          {view.town.npcs
            .filter((n: NpcView) => n.available)
            .map((npc: NpcView) => (
              <NpcCard
                key={npc.id}
                npc={npc}
                playerHealth={view.player.health}
                playerMaxHealth={view.player.maxHealth}
                playerGold={view.player.gold}
                loading={loading}
                talkingTo={talkingTo}
                onTalk={() => talkToNpc(npc.id, npc.name)}
                onShop={() => setTownPanel('shop')}
                onHeal={() => sendCommand({ type: 'TOWN_ACTION', action: 'rest' })}
                onTavern={() => setTownPanel('tavern')}
                onEnchanter={() => setTownPanel('enchanter')}
                onElder={() => setTownPanel('elder')}
              />
            ))}
        </div>
      )}

      {/* Messages section — scrolls internally */}
      <div
        data-testid="town-main-messages"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 8,
          paddingBottom: isMobile ? TAB_BAR_HEIGHT : 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {view.town?.lastRunSummary && (
          <InfoCard borderColor="#4a3014" marginBottom={0}>
            <div
              style={{
                color: colors.gold,
                fontStyle: 'italic',
                fontSize: 11,
                fontFamily: FONT_STACK,
              }}
            >
              {view.town.lastRunSummary}
            </div>
          </InfoCard>
        )}

        {view.town?.runSummaryStats && <RunSummaryPanel stats={view.town.runSummaryStats} />}

        {view.town && (
          <InfoCard borderColor={colors.steel} marginBottom={0}>
            <SectionLabel label="Faction Pressure" color={colors.steel} />
            <div style={{ fontSize: 11, color: colors.text, marginBottom: 6 }}>
              {view.town.factionPressureSummary}
            </div>
            <div style={{ fontSize: 10, color: colors.muted }}>
              {view.town.ogreProgress.summaryText}
            </div>
          </InfoCard>
        )}

        {view.town?.prepAdvice && view.town.prepAdvice.length > 0 && (
          <InfoCard borderColor="#1e4a2a" marginBottom={0}>
            <SectionLabel label="Preparation" color={colors.lime} />
            {view.town.prepAdvice.map((advice: string) => (
              <div
                key={advice}
                style={{ fontSize: 11, color: colors.text, padding: '1px 0' }}
              >
                &rsaquo; {advice}
              </div>
            ))}
          </InfoCard>
        )}

        {npcDialogue && (
          <InfoCard borderColor="#2a3a54" marginBottom={0} padding={10}>
            <div
              style={{
                fontSize: 11,
                color: colors.steel,
                fontWeight: 600,
                marginBottom: 5,
                fontFamily: FONT_STACK,
              }}
            >
              {npcDialogue.name}:
            </div>
            <div
              style={{
                fontSize: 11,
                color: colors.text,
                lineHeight: 1.5,
                fontStyle: 'italic',
                fontFamily: FONT_STACK,
              }}
            >
              {npcDialogue.text}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setNpcDialogue(null)}
                style={{ ...btnStyle, fontSize: 11, padding: '4px 12px', margin: 0 }}
              >
                Dismiss
              </button>
            </div>
          </InfoCard>
        )}

        {error && <p style={{ color: colors.blood, fontSize: 11 }}>{error}</p>}
      </div>

      {showFactionsModal && view.town?.factions && (
        <FactionDetailModal factions={view.town.factions} onClose={() => setShowFactionsModal(false)} />
      )}
    </div>
  );
}
