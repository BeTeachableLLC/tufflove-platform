/* eslint-disable no-unused-vars */
import React, { use } from "react";
import handleDownloadPdf from "./handleDownloadPdf";
import handleDownloadPdfBW from "./handleDownloadPdfBW";

const Results = ({ user, answers = [], questions = [], onRetakeTest }) => {
  // Group answers by their quadrant
  // const groupedResults = {
  //   Strength: [],
  //   Weakness: [],
  //   Opportunity: [],
  //   Threat: [],
  // };

  // Convert the object into an array
  const answersArray = Object.values(answers);

  const strengthsList = (answersArray || []).filter(
    (item) => item.quadrant === "Strength"
  );
  const weaknessesList = (answersArray || []).filter(
    (item) => item.quadrant === "Weakness"
  );
  const opportunitiesList = (answersArray || []).filter(
    (item) => item.quadrant === "Opportunity"
  );
  const threatsList = (answersArray || []).filter(
    (item) => item.quadrant === "Threat"
  );

  // Debugging: Log the answers and questions
  // console.log(user);
  // console.log("Answers:", answers);
  // console.log("Answers type", typeof answers);
  // console.log("Questions:", questions);

  // console.log("Strengths:", strengthsList);
  // console.log("Weaknesses:", weaknessesList);
  // console.log("Opportunities:", opportunitiesList);
  // console.log("Threats:", threatsList);

  // Object.entries(answers).forEach(([questionId, answer]) => {
  //   const question = questions.find((q) => q.id === Number(questionId));
  //   if (question) {
  //     // Ensure the quadrant is valid
  //     if (groupedResults.hasOwnProperty(answer.quadrant)) {
  //       groupedResults[answer.quadrant].push({
  //         question: question.question,
  //         selectedAnswer: answer.selected,
  //         response: answer.response,
  //       });
  //     } else {
  //       console.error(`Invalid quadrant: ${answer.quadrant}`); // Log invalid quadrant
  //     }
  //   }
  // });

  return (
    <>
      <div style={{ textAlign: "center", marginTop: "" }} className="riy">
        <img
          src="./logo-white-2.png"
          alt="logo-img"
          width={188.78}
          height={48}
          style={{
            alignItems: "center",
            padding: "40px",
            color: "white",
            position: "relative",
            top: "0px",
            left: "-600px",
            zIndex: 0,
            marginBottom: "-20px",
          }}
          className="rizImg"
        />
        <h2
          style={{
            fontSize: "2.25rem",
            fontWeight: "bold",
            marginTop: "20px",
            marginBottom: "16px",
          }}
        >
          {user} SWOT Analysis Results
        </h2>

        {/* Buttons Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px", // Space between buttons
            marginBottom: "20px",
          }}
          className="btns"
        >
          <button
            style={{
              padding: "10px 15px",
              backgroundColor: "#FECACA",
              cursor: "pointer",
              border: "none",
              height: "50px",
              borderRadius: "50px",
              fontSize: "14px",
              color: "black",
            }}
            onClick={() => window.location.reload()} // Refresh the page
            className="retake-test"
          >
            Retake Test
          </button>

          <button
            style={{
              padding: "10px 15px",
              backgroundColor: "#E5E7EB",
              cursor: "pointer",
              border: "none",
              borderRadius: "50px",
              width: "200px",
              height: "50px",
              fontWeight: "400",
              fontSize: "14px",
              color: "black",
            }}
            onClick={() =>
              handleDownloadPdf(
                strengthsList,
                weaknessesList,
                opportunitiesList,
                threatsList,
                user
              )
            } // Pass groupedResults to the PDF handler
            className="download-pdf"
          >
            Download PDF ( Coloured)
          </button>

          <button
            style={{
              padding: "10px 15px",
              backgroundColor: "#E5E7EB",
              cursor: "pointer",
              border: "none",
              borderRadius: "50px",
              width: "200px",
              height: "50px",
              fontWeight: "400",
              fontSize: "14px",
              color: "black",
            }}
            onClick={() =>
              handleDownloadPdfBW(
                strengthsList,
                weaknessesList,
                opportunitiesList,
                threatsList,
                user
              )
            } // Pass groupedResults to the PDF handler
            className="download-pdf"
          >
            Download PDF (Black & White)
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            className="swotBox"
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "90vw",
            }}
          >
            {/* Render Strength category */}
            <div
              className="custom-box"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                border: "1px solid grey",
                width: "40vw",
                maxHeight: "30vh",
                overflowY: "auto",
                marginBottom: "25px",
                backgroundColor: "#131A2A",
                boxShadow:
                  "0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                style={{
                  color: "white",
                  width: "400px",
                  textAlign: "center",
                  borderRadius: "20px",
                  padding: "10px",
                  background: "linear-gradient(to right, #3B82F6, #6357a5)",
                }}
              >
                Strength
              </h3>
              {strengthsList.map((result, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "16px",
                    padding: "16px",
                    // backgroundColor: "#D1FAE5",
                    borderRadius: "8px",
                    maxWidth: "500px",
                  }}
                  className="boxInner"
                >
                  <p
                    className="resq"
                    style={{ fontWeight: "600", color: "#3B82F6" }}
                  >
                    {result.question}
                  </p>
                  <p className="ans" style={{ color: "white" }}>
                    Answer: {result.selected}
                  </p>
                  <p
                    className="resp"
                    style={{ color: "white", fontWeight: "bold" }}
                  >
                    Response: {result.response}
                  </p>
                </div>
              ))}
            </div>

            {/* Render Weakness category */}
            <div
              className="custom-box"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                border: "1px solid grey",
                width: "40vw",
                maxHeight: "30vh",
                overflowY: "scroll",
                backgroundColor: "#131A2A",
                boxShadow:
                  "0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgba(0, 0, 0, 0.1)",
                marginBottom: "25px",
              }}
            >
              <h3
                style={{
                  color: "white",
                  width: "400px",
                  textAlign: "center",
                  borderRadius: "20px",
                  padding: "10px",
                  background: "linear-gradient(to right, #F87171, #6357a5)",
                }}
              >
                Weakness
              </h3>
              {weaknessesList.map((result, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "16px",
                    padding: "16px",
                    // backgroundColor: "#FECACA",
                    borderRadius: "8px",
                    maxWidth: "500px",
                  }}
                  className="boxInner"
                >
                  <p
                    className="resq"
                    style={{ fontWeight: "600", color: "#F87171" }}
                  >
                    {result.question}
                  </p>
                  <p
                    className="ans"
                    style={{
                      // color: "#F87171",
                      color: "white",
                    }}
                  >
                    Answer: {result.selected}
                  </p>
                  <p
                    className="resp"
                    style={{ color: "white", fontWeight: "bold" }}
                  >
                    Response: {result.response}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="swotBox"
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "90vw",
            }}
          >
            {/* Render Opportunity category */}
            <div
              className="custom-box"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                border: "1px solid grey",
                width: "40vw",
                maxHeight: "30vh",
                overflowY: "scroll",
                backgroundColor: "#131A2A",
                marginBottom: "25px",
                boxShadow:
                  "0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                style={{
                  color: "white",
                  width: "400px",
                  textAlign: "center",
                  borderRadius: "20px",
                  padding: "10px",
                  background: "linear-gradient(to right, #F59E0B, #6357a5)",
                }}
              >
                Opportunity
              </h3>
              {opportunitiesList.map((result, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "16px",
                    padding: "16px",
                    // backgroundColor: "#FEF3C7",
                    borderRadius: "8px",
                    maxWidth: "500px",
                  }}
                  className="boxInner"
                >
                  <p
                    className="resq"
                    style={{ fontWeight: "600", color: "#F59E0B" }}
                  >
                    {result.question}
                  </p>
                  <p
                    className="ans"
                    style={{
                      // color: "#F59E0B",
                      color: "white",
                    }}
                  >
                    Answer: {result.selected}
                  </p>
                  <p
                    className="resp"
                    style={{ color: "white", fontWeight: "bold" }}
                  >
                    Response: {result.response}
                  </p>
                </div>
              ))}
            </div>

            {/* Render Threat category */}
            <div
              className="custom-box"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                border: "1px solid grey",
                width: "40vw",
                maxHeight: "30vh",
                overflowY: "scroll",
                backgroundColor: "#131A2A",
                marginBottom: "25px",
                boxShadow:
                  "0 4px 8px rgba(0, 0, 0, 0.1), 0 6px 20px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                style={{
                  color: "white",
                  width: "400px",
                  textAlign: "center",
                  borderRadius: "20px",
                  padding: "10px",
                  background: "linear-gradient(to right, #EC4899, #6357a5)",
                }}
              >
                Threat
              </h3>
              {threatsList.map((result, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "16px",
                    padding: "16px",
                    // backgroundColor: "#F9A8D4",
                    borderRadius: "8px",
                    maxWidth: "500px",
                  }}
                  className="boxInner"
                >
                  <p
                    className="resq"
                    style={{ fontWeight: "600", color: "#EC4899" }}
                  >
                    {result.question}
                  </p>
                  <p
                    className="ans"
                    style={{
                      // color: "#EC4899" ,
                      color: "white",
                    }}
                  >
                    Answer: {result.selected}
                  </p>
                  <p
                    className="resp"
                    style={{ color: "white", fontWeight: "bold" }}
                  >
                    Response: {result.response}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Results;
