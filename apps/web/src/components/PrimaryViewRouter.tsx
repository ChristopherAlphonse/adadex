import type { ComponentProps, ReactNode } from "react";

import type { PrimaryNavIndex } from "../app/constants";
import { ActivityPrimaryView } from "./ActivityPrimaryView";
import { CanvasPrimaryView } from "./CanvasPrimaryView";
import { CodeIntelPrimaryView } from "./CodeIntelPrimaryView";
import { ConversationsPrimaryView } from "./ConversationsPrimaryView";
import { DeckPrimaryView } from "./DeckPrimaryView";
import { PromptsPrimaryView } from "./PromptsPrimaryView";
import { SettingsPrimaryView } from "./SettingsPrimaryView";

type PrimaryViewRouterProps = {
  activePrimaryNav: PrimaryNavIndex;
  deckPrimaryViewProps: ComponentProps<typeof DeckPrimaryView>;
  activityPrimaryViewProps: ComponentProps<typeof ActivityPrimaryView>;
  settingsPrimaryViewProps: ComponentProps<typeof SettingsPrimaryView>;
  canvasPrimaryViewProps: ComponentProps<typeof CanvasPrimaryView>;
  conversationsEnabled: boolean;
  onConversationsSidebarContent: (content: ReactNode) => void;
  onConversationsActionPanel: (content: ReactNode) => void;
  promptsEnabled: boolean;
  onPromptsSidebarContent: (content: ReactNode) => void;
};

export const PrimaryViewRouter = ({
  activePrimaryNav,
  deckPrimaryViewProps,
  activityPrimaryViewProps,
  settingsPrimaryViewProps,
  canvasPrimaryViewProps,
  conversationsEnabled,
  onConversationsSidebarContent,
  onConversationsActionPanel,
  promptsEnabled,
  onPromptsSidebarContent,
}: PrimaryViewRouterProps) => {
  if (activePrimaryNav === 2) {
    return <DeckPrimaryView {...deckPrimaryViewProps} />;
  }

  if (activePrimaryNav === 3) {
    return <ActivityPrimaryView {...activityPrimaryViewProps} />;
  }

  if (activePrimaryNav === 4) {
    return <CodeIntelPrimaryView enabled={activePrimaryNav === 4} />;
  }

  if (activePrimaryNav === 5) {
    return (
      <ConversationsPrimaryView
        enabled={conversationsEnabled}
        onSidebarContent={onConversationsSidebarContent}
        onActionPanel={onConversationsActionPanel}
      />
    );
  }

  if (activePrimaryNav === 6) {
    return (
      <PromptsPrimaryView enabled={promptsEnabled} onSidebarContent={onPromptsSidebarContent} />
    );
  }

  if (activePrimaryNav === 7) {
    return <SettingsPrimaryView {...settingsPrimaryViewProps} />;
  }

  return <CanvasPrimaryView {...canvasPrimaryViewProps} />;
};
