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
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            backgroundColor: "#4caf50",
            transition: "width 0.3s ease-in-out",
          }}
        />
      </div>

      {/* Step Information */}
      <div style={{ paddingTop: "10px", fontSize: "18px", color: "#12192a" }}>
        Question {currentStep } of {totalSteps }
        {/* Step {currentStep} of {totalSteps} in Section {currentSection} ({currentStep} of {totalSections}) */}
      </div>
    </div>
  );
};

export default ProgressBar;
