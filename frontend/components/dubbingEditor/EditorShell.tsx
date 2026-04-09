"use client";

import "./dubbing-editor.css";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import CenterStage from "./CenterStage";
import BottomTimeline from "./BottomTimeline";
import RightInspector from "./RightInspector";

export default function EditorShell() {
  return (
    <div className="dubbing-editor-root h-[100dvh] flex flex-col bg-[#12141a] text-[#e8eaed] overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0 min-w-0">
        <LeftPanel />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#16181e]">
          <div className="flex-1 min-h-0 p-3 flex flex-col">
            <CenterStage />
          </div>
          <BottomTimeline />
        </div>
        <RightInspector />
      </div>
    </div>
  );
}
