import React from "react";

const Question = ({ question, onAnswer, selectedAnswer }) => {
  return (
    <div className="text-center">
      <h2
        style={{
          fontFamily: "Poppins, sans-serif", // Corrected font family syntax
          marginTop: "60px",
          maxWidth: "600px",
          width: "600px",
          fontSize: "18px"
        }}
        className=" quest text-lg font-bold mb-4"
      >
        {question.question}
      </h2>
      <div
        className="flex flex-col gap-3"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {question.options.map((option) => (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <button
              key={option.label}
              className="opts"
              onClick={() => onAnswer(option)}
              style={{
                fontFamily: "Poppins, sans-serif", // Corrected font family syntax
                fontWeight: 500,
                fontSize: "19px",
                lineHeight: 1,
                letterSpacing: "-0.05em",
                borderRadius: "15px",
                border: "0.5px solid black",
                backgroundColor:
                  selectedAnswer === option.label ? "#12192a" : "#FFFFFF", // Blue when selected, Red otherwise
                color: selectedAnswer === option.label ? "#FFFFFF" : "#000000", // White text when selected
                cursor: "pointer",
                transition: "background-color 0.2s ease-in-out",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "22px",
                marginRight: "20px",
                marginBottom: "5px"
              }}
            >
              <></>
            </button>
            <div>
              <>
                <p style={{ fontSize: "16px",}}>{option.label}</p>
              </>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Question;
