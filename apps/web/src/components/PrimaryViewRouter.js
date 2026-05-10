import { jsx as _jsx } from "react/jsx-runtime";
import { ActivityPrimaryView } from "./ActivityPrimaryView";
import { CanvasPrimaryView } from "./CanvasPrimaryView";
import { CodeIntelPrimaryView } from "./CodeIntelPrimaryView";
import { ConversationsPrimaryView } from "./ConversationsPrimaryView";
import { DeckPrimaryView } from "./DeckPrimaryView";
import { PromptsPrimaryView } from "./PromptsPrimaryView";
import { SettingsPrimaryView } from "./SettingsPrimaryView";
export const PrimaryViewRouter = ({ activePrimaryNav, deckPrimaryViewProps, activityPrimaryViewProps, settingsPrimaryViewProps, canvasPrimaryViewProps, conversationsEnabled, onConversationsSidebarContent, onConversationsActionPanel, promptsEnabled, onPromptsSidebarContent, }) => {
    if (activePrimaryNav === 2) {
        return _jsx(DeckPrimaryView, { ...deckPrimaryViewProps });
    }
    if (activePrimaryNav === 3) {
        return _jsx(ActivityPrimaryView, { ...activityPrimaryViewProps });
    }
    if (activePrimaryNav === 4) {
        return _jsx(CodeIntelPrimaryView, { enabled: activePrimaryNav === 4 });
    }
    if (activePrimaryNav === 6) {
        return (_jsx(ConversationsPrimaryView, { enabled: conversationsEnabled, onSidebarContent: onConversationsSidebarContent, onActionPanel: onConversationsActionPanel }));
    }
    if (activePrimaryNav === 7) {
        return (_jsx(PromptsPrimaryView, { enabled: promptsEnabled, onSidebarContent: onPromptsSidebarContent }));
    }
    if (activePrimaryNav === 8) {
        return _jsx(SettingsPrimaryView, { ...settingsPrimaryViewProps });
    }
    return _jsx(CanvasPrimaryView, { ...canvasPrimaryViewProps });
};
