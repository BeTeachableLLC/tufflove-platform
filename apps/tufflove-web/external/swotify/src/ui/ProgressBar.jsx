/* eslint-disable no-unused-vars */
import React from "react";

const ProgressBar = ({
  progress,
  currentStep,
  totalSteps,
  currentSection,
  totalSections,
}) => {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          width: "100%",
          backgroundColor: "#f3f3f3",
          borderRadius: "8px",
          margin: "20px 0",
          overflow: "hidden",
          height: "20px",
        }}
      >
        <div
        className="prog"
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: "#131A2A",
            transition: "width 0.3s ease-in-out",
          }}
        />
      </div>

      {/* Step Information */}
      <div style={{ paddingTop: "10px", fontSize: "20px", color: "white" }}>
        Question {currentStep } of  {totalSteps }
        {/* Step {currentStep} of {totalSteps} in Section {currentSection} ({currentStep} of {totalSections}) */}
      </div>
    </div>
  );
};

export default ProgressBar;
