/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
// import Table from "../Components/Table";
import "../App.css";
// import { data } from "autoprefixer";
import { colors } from "@mui/material";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "jspdf-autotable";
// import { useReactToPrint } from "react-to-print";

import newpdf from "./newpdf";

ChartJS.register(ArcElement, Tooltip, Legend);

const questionsUpdate = [
  {
    section: "Section 1",
    profile: "Profile C",
    questions: [
      {
        id: 1,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Plan my way out.",
            weight: "C",
          },
          {
            text: "Under intense stress I tend to Become Distrustful.",
            weight: "D",
          },
        ],
      },
      {
        id: 2,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become a big Talker.",
            weight: "B",
          },
          {
            text: "Under intense stress I tend to Become Withdrawn.",
            weight: "C",
          },
        ],
      },
      {
        id: 3,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Impractical.",
            weight: "C",
          },
          { text: "Under intense stress I tend to Become Cross.", weight: "D" },
        ],
      },
      {
        id: 4,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Hotheaded.",
            weight: "A",
          },
          {
            text: "Under intense stress I tend to Become Careless.",
            weight: "B",
          },
        ],
      },
      {
        id: 5,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Negative.",
            weight: "D",
          },
          {
            text: "Under intense stress I tend to Become Dictatorial.",
            weight: "A",
          },
        ],
      },
      {
        id: 6,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Too Permissive.",
            weight: "B",
          },
          {
            text: "Under intense stress I tend to Become Stubborn.",
            weight: "D",
          },
        ],
      },
      {
        id: 7,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Indecisive.",
            weight: "C",
          },
          {
            text: "Under intense stress I tend to Become More Likely To Act.",
            weight: "A",
          },
        ],
      },
      {
        id: 8,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Bearish.",
            weight: "A",
          },
          {
            text: "Under intense stress I tend to Become Manipulative.",
            weight: "B",
          },
        ],
      },
      {
        id: 9,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Very Cautious.",
            weight: "D",
          },
          {
            text: "Under intense stress I tend to Become Abrupt.",
            weight: "A",
          },
        ],
      },
      {
        id: 10,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Reckless.",
            weight: "B",
          },
          {
            text: "Under intense stress I tend to Become Inflexible.",
            weight: "D",
          },
        ],
      },
      {
        id: 11,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Passive.",
            weight: "C",
          },
          {
            text: "Under intense stress I tend to Insist On My Own Way.",
            weight: "A",
          },
        ],
      },
      {
        id: 12,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become High-Handed.",
            weight: "A",
          },
          {
            text: "Under intense stress I tend to Become Rebellious.",
            weight: "B",
          },
        ],
      },
      {
        id: 13,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Very Picky.",
            weight: "D",
          },
          {
            text: "Under intense stress I tend to Become Overbearing.",
            weight: "A",
          },
        ],
      },
      {
        id: 14,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Extremely Careless.",
            weight: "B",
          },
          { text: "Under intense stress I tend to Become Rigid.", weight: "D" },
        ],
      },
      {
        id: 15,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Scheming.",
            weight: "C",
          },
          {
            text: "Under intense stress I tend to Become Concerned With Details.",
            weight: "D",
          },
        ],
      },
      {
        id: 16,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Conceited.",
            weight: "B",
          },
          {
            text: "Under intense stress I tend to Become Anxious and Afraid.",
            weight: "C",
          },
        ],
      },
      {
        id: 17,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Sensitive.",
            weight: "C",
          },
          {
            text: "Under intense stress I tend to Become Hostile.",
            weight: "A",
          },
        ],
      },
      {
        id: 18,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Opinionated.",
            weight: "B",
          },
          {
            text: "Under intense stress I tend to Become Very Emotional.",
            weight: "C",
          },
        ],
      },
      {
        id: 19,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become Uncertain.",
            weight: "C",
          },
          {
            text: "Under intense stress I tend to Become Domineering.",
            weight: "A",
          },
        ],
      },
      {
        id: 20,
        question: "Under Intense Stress, I Tend to",
        options: [
          {
            text: "Under intense stress I tend to Become a Bluffer.",
            weight: "B",
          },
          {
            text: "Under intense stress I tend to Become Distrustful.",
            weight: "D",
          },
        ],
      },
    ],
  },
  {
    section: "Section 2",
    profile: "Profile P",
    questions: [
      {
        id: 21,
        question: "I Think I Should",
        options: [
          { text: "I think I should Develop New Plans.", weight: "C" },
          { text: "I think I should Be Consistent.", weight: "D" },
        ],
      },
      {
        id: 22,
        question: "I Think I Should",
        options: [
          { text: "I think I should Stick to the Rules.", weight: "D" },
          { text: "I think I should Supervise Others.", weight: "A" },
        ],
      },
      {
        id: 23,
        question: "I Think I Should",
        options: [
          {
            text: "I think I should Depend On My Own Experiences.",
            weight: "A",
          },
          { text: "I think I should Be a Self-Starter.", weight: "C" },
        ],
      },
      {
        id: 24,
        question: "I Think I Should",
        options: [
          { text: "I think I should Confer with Other People.", weight: "B" },
          { text: "I think I should Look for New Ideas.", weight: "C" },
        ],
      },
      {
        id: 25,
        question: "I Think I Should",
        options: [
          { text: "I think I should Give Others Directions.", weight: "A" },
          { text: "I think I should Influence Others.", weight: "B" },
        ],
      },
      {
        id: 26,
        question: "I Think I Should",
        options: [
          { text: "I think I should Conserve Resources.", weight: "D" },
          { text: "I think I should Create Ideas.", weight: "C" },
        ],
      },
      {
        id: 27,
        question: "I Think I Should",
        options: [
          { text: "I think I should Do What Works.", weight: "A" },
          { text: "I think I should Develop New Approaches.", weight: "C" },
        ],
      },
      {
        id: 28,
        question: "I Think I Should",
        options: [
          {
            text: "I think I should Coordinate Group Activities.",
            weight: "B",
          },
          { text: "I think I should Follow Tradition.", weight: "D" },
        ],
      },
      {
        id: 29,
        question: "I Think I Should",
        options: [
          { text: "I think I should Achieve By Using Ideas.", weight: "C" },
          { text: "I think I should Do Something.", weight: "A" },
        ],
      },
      {
        id: 30,
        question: "I Think I Should",
        options: [
          {
            text: "I think I should Arrange Things In a Pattern.",
            weight: "D",
          },
          { text: "I think I should Build Something.", weight: "A" },
        ],
      },
      {
        id: 31,
        question: "I Think I Should",
        options: [
          { text: "I think I should Explore New Ideas.", weight: "C" },
          { text: "I think I should Help Other People.", weight: "B" },
        ],
      },
      {
        id: 32,
        question: "I Think I Should",
        options: [
          { text: "I think I should Involve Others.", weight: "B" },
          { text: "I think I should Keep Things In Order.", weight: "D" },
        ],
      },
      {
        id: 33,
        question: "I Think I Should",
        options: [
          { text: "I think I should Produce Something.", weight: "A" },
          { text: "I think I should Be Precise.", weight: "D" },
        ],
      },
      {
        id: 34,
        question: "I Think I Should",
        options: [
          { text: "I think I should Keep On a Schedule.", weight: "D" },
          { text: "I think I should Be Hopeful.", weight: "B" },
        ],
      },
      {
        id: 35,
        question: "I Think I Should",
        options: [
          {
            text: "I think I should Work With Concepts and Ideas.",
            weight: "C",
          },
          {
            text: "I think I should Be Careful When Working With Facts and Figures.",
            weight: "D",
          },
        ],
      },
      {
        id: 36,
        question: "I Think I Should",
        options: [
          { text: "I think I should Should Be Persuasive.", weight: "B" },
          { text: "I feel that Others Should Respect Me.", weight: "A" },
        ],
      },
      {
        id: 37,
        question: "I Think I Should",
        options: [
          { text: "I think I should Promote Programs to Others.", weight: "B" },
          {
            text: "I think I should Compete With Myself To Do Better.",
            weight: "C",
          },
        ],
      },
      {
        id: 38,
        question: "I Think I Should",
        options: [
          {
            text: "I think I should Work Within Guidelines and Forms.",
            weight: "D",
          },
          {
            text: "I think I should Coordinate Group Cooperation.",
            weight: "B",
          },
        ],
      },
      {
        id: 39,
        question: "I Think I Should",
        options: [
          { text: "I think I should Work with Ideas and Plans.", weight: "C" },
          { text: "I think I should Get Something Done.", weight: "A" },
        ],
      },
      {
        id: 40,
        question: "I Think I Should",
        options: [
          {
            text: "I think I should Organize Others For The Good of The Group.",
            weight: "B",
          },
          { text: "I think I should Produce Things.", weight: "A" },
        ],
      },
    ],
  },
  {
    section: "Section 3",
    profile: "Profile A",
    questions: [
      {
        id: 41,
        question: "What I am comfortable doing?",
        options: [
          { text: "I am decisive and firm in my actions.", weight: "A" },
          {
            text: "I show great enthusiasm when I am defending a cause.",
            weight: "B",
          },
        ],
      },
      {
        id: 42,
        question: "What I am comfortable doing?",
        options: [
          { text: "I enjoy meeting new people.", weight: "B" },
          { text: "I prefer harmonious conditions.", weight: "C" },
        ],
      },
      {
        id: 43,
        question: "What I am comfortable doing?",
        options: [
          { text: "I am comfortable planning future events.", weight: "C" },
          { text: "I prefer following a procedure.", weight: "D" },
        ],
      },
      {
        id: 44,
        question: "What I am comfortable doing?",
        options: [
          { text: "I am comfortable taking action.", weight: "A" },
          { text: "I am most comfortable being creative.", weight: "C" },
        ],
      },
      {
        id: 45,
        question: "What I am comfortable doing?",
        options: [
          { text: "I enjoy being friendly to people.", weight: "B" },
          { text: "I enjoy working with details and specifics.", weight: "D" },
        ],
      },
      {
        id: 46,
        question: "What I am comfortable doing?",
        options: [
          { text: "I enjoy thinking about alternatives.", weight: "C" },
          { text: "I enjoy looking for exceptions.", weight: "D" },
        ],
      },
      {
        id: 47,
        question: "What I am comfortable doing?",
        options: [
          { text: "I prefer being direct with people.", weight: "A" },
          { text: "I am comfortable checking accuracy.", weight: "D" },
        ],
      },
      {
        id: 48,
        question: "What I am comfortable doing?",
        options: [
          { text: "I enjoy doing things with a group.", weight: "B" },
          { text: "I enjoy looking at things in a new way.", weight: "C" },
        ],
      },
      {
        id: 49,
        question: "What I am comfortable doing?",
        options: [
          { text: "I am comfortable being an idea person.", weight: "C" },
          { text: "I enjoy exercising control and order.", weight: "D" },
        ],
      },
      {
        id: 50,
        question: "What I am comfortable doing?",
        options: [
          { text: "I enjoy being active.", weight: "A" },
          { text: "I enjoy being exact and correct.", weight: "D" },
        ],
      },
      {
        id: 51,
        question: "What I am comfortable doing?",
        options: [
          { text: "I tend to expect the best to happen.", weight: "B" },
          {
            text: "I enjoy working methodically within a system.",
            weight: "D",
          },
        ],
      },
      {
        id: 52,
        question: "What I am comfortable doing?",
        options: [
          {
            text: "I am comfortable being a powerful and forceful person.",
            weight: "A",
          },
          { text: "I enjoy imagining possibilities.", weight: "C" },
        ],
      },
      {
        id: 53,
        question: "What I am comfortable doing?",
        options: [
          { text: "I am at ease cooperating with others.", weight: "B" },
          { text: "I enjoy thinking independently.", weight: "C" },
        ],
      },
      {
        id: 54,
        question: "What I am comfortable doing?",
        options: [
          { text: "I am direct in my approach to others.", weight: "A" },
          {
            text: "I am comfortable being warm and comforting to others.",
            weight: "B",
          },
        ],
      },
      {
        id: 55,
        question: "What I am comfortable doing?",
        options: [
          {
            text: "If I believe in a cause, I will sacrifice my own interest.",
            weight: "B",
          },
          { text: "I enjoy doing things in an orderly way.", weight: "D" },
        ],
      },
      {
        id: 56,
        question: "What I am comfortable doing?",
        options: [
          {
            text: "I am comfortable acting with excitement and focus.",
            weight: "A",
          },
          { text: "I am comfortable thinking about new ideas.", weight: "C" },
        ],
      },
      {
        id: 57,
        question: "What I am comfortable doing?",
        options: [
          { text: "I enjoy the give and take of conversation.", weight: "B" },
          {
            text: "I prefer following a specific order or directions.",
            weight: "D",
          },
        ],
      },
      {
        id: 58,
        question: "What I am comfortable doing?",
        options: [
          {
            text: "I am most comfortable accomplishing something.",
            weight: "A",
          },
          {
            text: "I am comfortable being cautious and conscientious.",
            weight: "D",
          },
        ],
      },
      {
        id: 59,
        question: "What I am comfortable doing?",
        options: [
          {
            text: "I enjoy situations where I can take action or do something.",
            weight: "A",
          },
          {
            text: "I am at ease showing understanding and compassion.",
            weight: "C",
          },
        ],
      },
      {
        id: 60,
        question: "What I am comfortable doing?",
        options: [
          {
            text: "I am comfortable taking command of most situations.",
            weight: "A",
          },
          {
            text: "I am friendly and I enjoy conversations with strangers.",
            weight: "B",
          },
        ],
      },
    ],
  },
];

//{C: red, B: yellow, D: blue, A: green}
// (4) ['red', 'yellow', 'blue', 'green']

const App = () => {
  // const [totals, setTotals] = useState({ Red: 0, Yellow: 0, Blue: 0, Green: 0 });
  const [highestColor, setHighestColorName] = useState(null);
  const [secondHighestColor2, setSecondHighestColorName] = useState(null);
  const [thirdHighestColor2, setThirdHighestColorName] = useState(null);
  const [fourthHighestColor2, setFourthHighestColorName] = useState(null);
  const [childValue, setChildValue] = useState([]);
  const [parentValue, setParentValue] = useState([]);
  const [adultValue, setAdultValue] = useState([]);
  const [finalResults, setFinalResults] = useState([]);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [showResultsFinal, setShowResultsFinal] = useState(true);
  const [identity, setIdentity] = useState("");
  const [identity2, setIdentity2] = useState("");
  const [identity3, setIdentity3] = useState("");
  const [identity4, setIdentity4] = useState("");
  const [userDetails, setUserDetails] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const chartRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false); // State to track PDF generation

  const [childPdfValue, setChildPdfValue] = useState([]);
  const [parentPdfValue, setParentPdfValue] = useState([]);
  const [adultPdfValue, setAdultPdfValue] = useState([]);
  const [totalCombinedPdf, setTotalCombinedPdf] = useState([]);

  const [feedback, setFeedback] = useState("");
  const [feedback2, setFeedback2] = useState("");
  const [feedback3, setFeedback3] = useState("");
  const [feedback4, setFeedback4] = useState("");

  
  const handleAnswerSelection = (questionId, selectedOption) => {
    // Store answer and its weight in state
    setAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOption,
    }));

    // Move to the next question
    if (
      currentQuestion <
      questionsUpdate[currentSection].questions.length - 1
    ) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      // All questions in the current section have been answered
      if (currentSection < questionsUpdate.length - 1) {
        setCurrentSection((prev) => prev + 1);
        setCurrentQuestion(0);
      } else {
        // Show results if all sections are completed
        setShowResults(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    } else if (currentSection > 0) {
      setCurrentSection((prev) => prev - 1);
      setCurrentQuestion(
        questionsUpdate[currentSection - 1].questions.length - 1
      );
    }
  };

  const calculateProgress = () => {
    const totalQuestions = questionsUpdate.reduce(
      (sum, section) => sum + section.questions.length,
      0
    );
    const answeredQuestions = Object.keys(answers).length;

    return (answeredQuestions / totalQuestions) * 100;
  };

  const getCurrentStep = () => {
    // Calculate the total number of questions answered so far
    const overallStep =
      questionsUpdate
        .slice(0, currentSection) // Get all sections before the current one
        .reduce((sum, section) => sum + section.questions.length, 0) +
      currentQuestion +
      1; // Add current question index (1-based)

    // Section-specific calculations
    const sectionStep = currentQuestion + 1; // Current question in the section (1-based)
    const sectionTotal = questionsUpdate[currentSection].questions.length; // Total questions in current section

    // Overall total questions
    const overallTotal = questionsUpdate.reduce(
      (sum, section) => sum + section.questions.length,
      0
    );

    // Return formatted step info
    return `Step ${sectionStep} of ${sectionTotal} in ${questionsUpdate[currentSection].section} 
    (${overallStep} of ${overallTotal})`;
  };

  console.log(currentSection);
  const profiling = () => {
    if (currentSection === 0) {
      return (
        <>
          <p
            className="topicHeader"
            style={{ fontSize: "18px", fontWeight: "bolder" }}
          >
            How I Respond Under Intense Pressure
          </p>
          <p className="intro" style={{ maxWidth: "40vw", fontSize: "12px" }}>
            Each question below is divided into two statements. Choose the
            statement in either column that best describes how you feel under
            intense stress. There are no wrong answers. . For example: On
            Statement 1 if you tend to become distrustful under stress more than
            you tend to plan your way out, you would click on that option. You
            must select one answer for each of the 20 statements even if you do
            not agree completely with either answer.
          </p>
        </>
      );
    } else if (currentSection === 1) {
      return (
        <>
          <p
            className="topicHeader"
            style={{ fontSize: "18px", fontWeight: "bolder" }}
          >
            What I Think I Should Do
          </p>
          <p className="intro" style={{ maxWidth: "40vw", fontSize: "12px" }}>
            Each question below is divided into two statements. Choose the
            statement in either column that best describes what you think you
            should do (or how you think others want you be).There are no wrong
            answers. For example: On Statement 1 if you think you should develop
            new plans more than you think you should be consistent, you would
            click on that option. You need to select one answer for each of the
            20 statements even if you do not agree completely with either
            answer.
          </p>
        </>
      );
    } else if (currentSection === 2) {
      return (
        <>
          <p
            className="topicHeader"
            style={{ fontSize: "18px", fontWeight: "bolder" }}
          >
            What I Am Comfortable Doing
          </p>
          <p className="intro" style={{ maxWidth: "40vw", fontSize: "12px" }}>
            Each question below is divided into two statements. Choose the
            statement in either column that best describes what you are
            comfortable doing. There are no wrong answers. For example: On
            Statement 1 if you show great enthusiasm defending a cause more than
            you are decisive and firm in your actions, you would click on that
            option. You must select one answer for each of the 20 statements
            even if you do not agree completely with either answer.
          </p>
        </>
      );
    } else {
      return <p>No profile available</p>;
    }
  };

  // Calculate the results based on selected answers
  const calculateResults = () => {
    const resultCounts = {};

    Object.entries(answers).forEach(([questionId, selectedOption]) => {
      const question = questionsUpdate
        .flatMap((section) => section.questions)
        .find((q) => q.id === parseInt(questionId));

      if (question) {
        const option = question.options.find(
          (opt) => opt.text === selectedOption
        );
        if (option && option.weight) {
          resultCounts[option.weight] = (resultCounts[option.weight] || 0) + 1;
        }
      }
    });

    console.log(resultCounts);
    return resultCounts;
  };

  const handleSubmit = () => {
    console.log("Quiz Submitted", answers);
    if (!userDetails.name || !userDetails.email || !userDetails.phone) {
      alert("Please fill in all fields before submitting.");
      return;
    }
    setShowResults(true);
  };

  const handleRetake = () => {
    setCurrentSection(0);
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setShowResultsFinal(false);
  };

  const allQuestionsAnswered =
    Object.keys(answers).length ===
    questionsUpdate.reduce((sum, section) => sum + section.questions.length, 0);

  const resultData = calculateResults();

  const data = {
    labels: Object.keys(resultData),
    datasets: [
      {
        label: "Profile Strengths",
        data: Object.values(resultData),
        // backgroundColor: [ "#4BC0C0", "#36A2EB", "#FFCE56","#FF6384"],
        backgroundColor: ["blue", "green", "red", "yellow"],
        hoverOffset: 4,
      },
    ],
  };

  const valuesArray = data.datasets[0].data;
  const colorsArray = data.datasets[0].backgroundColor;
  const maxValue = Math.max(...valuesArray); // Find the highest value
  const maxIndex = valuesArray.indexOf(maxValue); // Find the index of the highest value

  // Create an array of value-index pairs
  const valueIndexPairs = valuesArray.map((value, index) => ({ value, index }));

  // Sort the pairs by value in descending order
  valueIndexPairs.sort((a, b) => b.value - a.value);

  // Get the indices of the 2nd, 3rd, and 4th highest values
  const secondHighestIndex = valueIndexPairs[1]?.index;
  const thirdHighestIndex = valueIndexPairs[2]?.index;
  const fourthHighestIndex = valueIndexPairs[3]?.index;

  // Fetch the corresponding colors
  const secondHighestColor = colorsArray[secondHighestIndex];
  const thirdHighestColor = colorsArray[thirdHighestIndex];
  const fourthHighestColor = colorsArray[fourthHighestIndex];

  console.log(valueIndexPairs);
  console.log("Values Array:", valuesArray);
  console.log("Colors Array:", colorsArray);
  console.log(`2nd Highest Color: ${secondHighestColor}`);
  console.log(`3rd Highest Color: ${thirdHighestColor}`);
  console.log(`4th Highest Color: ${fourthHighestColor}`);

  // Step 2: Get the corresponding color from the colors array
  const correspondingColor = colorsArray[maxIndex];

  console.log(
    `Highest value: ${maxValue}, Position: ${maxIndex}, Color: ${correspondingColor}`
  );
  console.log(colorsArray[0]);
  console.log(colors);

  const ColorFeedback = () => {
    // const [feedback, setFeedback] = useState("");
    // const [feedback2, setFeedback2] = useState("");
    // const [feedback3, setFeedback3] = useState("");
    // const [feedback4, setFeedback4] = useState("");

    // setIdentity(setFeedback);
    console.log(feedback);
    const colors = [
      {
        name: "Red",
        value: "Decision Makers, Goal Oriented, Results",
        code: "#FF0000",
        result: valuesArray[2],
      },
      {
        name: "Yellow",
        value: "Communicators, Participants, Adaptable",
        code: "#FFFF00",
        result: valuesArray[3],
      },
      {
        name: "Blue",
        value: "Problem Solver, Good Listener",
        code: "#0000FF",
        result: valuesArray[0],
      },
      {
        name: "Green",
        value: "Accurate, Consistent, Analytical",
        code: "#00FF00",
        result: valuesArray[1],
      },
    ];

    const sortedColors = [...colors].sort((a, b) => b.result - a.result);
    console.log("sorted", sortedColors);
    // Helper function to convert hex color to an integer value
    const hexToInt = (hex) => parseInt(hex.slice(1), 16);

    // Find the color with the highest value
    const getHighestColor = () =>
      colors.reduce((max, color) =>
        hexToInt(color.value) > hexToInt(max.value) ? color : max
      );

    // Generate feedback message based on the highest color value
    useEffect(() => {
      // const highestColor = getHighestColor();
      if (correspondingColor === "red") {
        setIdentity("Decision Makers, Goal Oriented, Result Driven");
        setFeedback(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
            <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
              A cautious person, that tend to do all 'by the book', you analyze
              any situation before you commit to it, you look before you cross
              the street and walk before you run, your goal is to avoid to
              making the same mistake twice.
            </p> */}
            <h3> Result-Oriented and Driven </h3>
            <p>
              You are a highly driven and goal-oriented individual who is
              focused on achieving tangible results. You have a direct
              communication style and are confident in your abilities, often
              taking a competitive approach to tasks and projects.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                Direct Communication Style When communicating with you, it is
                best to be concise and to the point. You prefer clear and
                straightforward information, as you believe that people should
                already know what they are doing. You are a "bottom-line" person
                who values efficiency and getting things done.
              </p>
            </div>
            {/* <table class="custom-table">
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>STRENGTHS</th>
                  <th>WEAKNESSES</th>
                  <th>NEEDS</th>
                </tr>
              </thead>
              <tbody className="tbody">
                <tr style={{ textAlign: "left" }}>
                  <td>Patient</td>
                  <td>Avoid Conflct</td>
                  <td>Time</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Problem Solver</td>
                  <td>Procastination</td>
                  <td>Freedom</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Evalute Alternative</td>
                  <td>Rationalize</td>
                  <td>Alternatives</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Improvments</td>
                  <td>"Over-imporove"</td>
                  <td></td>
                </tr>
              </tbody>
            </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths lie in your ability to make decisions,
                achieve your goals, and take calculated risks. However, you may
                sometimes overlook the importance of caution and long-term
                considerations, focusing instead on short-term results.
                Additionally, you have a very high built-in sense of urgency.
                This allows you to make decisions and get results quickly, but
                can also cause frustration when working with others who don't
                have the same motor.
              </p>{" "}
            </div>
            <div>
              <h3>Needs and Motivations </h3>
              <p>
                To thrive, you require a sense of power, authority, and the
                ability to win. You are motivated by quantifiable achievements
                and the opportunity to demonstrate your competence and drive.{" "}
              </p>
            </div>
            <p>
              Overall, you are a highly capable and results-oriented individual
              who values direct communication, decision-making, and the
              achievement of your goals. By understanding your personality
              traits and communication preferences, others can more effectively
              collaborate and work with you.
            </p>
          </div>
        );
      } else if (correspondingColor === "yellow") {
        setIdentity("Communicators, Participants, Adaptable");
        setFeedback(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3>Friendly, Outgoing, and Emotional</h3>
            <p>
              You are a vibrant and sociable individual who thrives on human
              connection and spontaneity. Your orientation is people-focused,
              with results taking a secondary priority. You are enthusiastic,
              expressive, and enjoy engaging in lively conversations.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is best to ask for your help and
                input. You appreciate being involved and valued for your unique
                perspective. Showcase your enthusiasm and excitement, and look
                for common ground that can foster a sense of camaraderie. Avoid
                getting bogged down in details, and instead focus on creating a
                positive and engaging atmosphere.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your strong communication skills,
                adaptability, and optimistic outlook. However, you may sometimes
                struggle with a lack of time management, difficulty following up
                on tasks, and a tendency to be overly subjective.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require recognition, acceptance, and
                  the opportunity to exert influence and be involved. You are
                  motivated by flexibility, options, and the chance to
                  participate actively in discussions and decision-making.
                </p>
              </div>
              <p>
                Overall, you are a vibrant and people-oriented individual who
                thrives on social interaction, enthusiasm, and a sense of
                belonging. By understanding your personality traits and
                communication preferences, others can more effectively engage
                and collaborate with you.
              </p>
            </div>
          </div>
        );
      } else if (correspondingColor === "blue") {
        setIdentity("Patient, Problem Solver, Good Listener");
        setFeedback(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3>Sincere and Focused on Problem-Solving</h3>
            <p>
              You are a sincere and thoughtful individual who takes great pride
              in being a good listener and a problem-solver. Your focus is on
              making things better and maintaining harmony, often taking on the
              role of peacekeeper.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is important to ask for your
                input and opinions. You thrive when given the freedom to
                evaluate alternatives and choose the best course of action.
                Showing appreciation for your ideas and allowing you to
                contribute to the problem-solving process is key.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your ability to listen attentively,
                your patience, and your skill in evaluating alternatives and
                identifying improvements. However, you may sometimes struggle
                with conflict avoidance and procrastination, and can become
                overly focused on perfecting a solution.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of appreciation, the
                  freedom to explore options, and the time needed to thoroughly
                  consider and implement solutions. You are motivated by the
                  opportunity to make a positive impact and contribute to the
                  overall well-being of the group or organization.
                </p>
              </div>
              <p>
                Overall, you are a supportive and problem-solving oriented
                individual who values collaboration, consensus-building, and
                continuous improvement. By understanding your personality traits
                and communication preferences, others can more effectively
                engage and work with you.
              </p>
            </div>
          </div>
        );
      } else if (correspondingColor === "green") {
        setIdentity("Accurate, Consistent, Analytical");
        setFeedback(
          <>
            <div>
              <h3>Analytical and Cautious</h3>
              <p>
                You are an analytical individual who values consistency,
                caution, and high standards. You carefully consider your
                decisions and actions, preferring to "look before you leap" in
                order to avoid repeating past mistakes.
              </p>
              <div>
                <h3>Communication Preferences </h3>
                <p>
                  When communicating with you, it is important to provide a
                  clear and structured approach, addressing the "how" rather
                  than just the "what." You thrive on predictability and
                  control, so presenting detailed information, facts, and
                  testimonials early on will help establish trust and
                  credibility.
                </p>
              </div>
              {/* <table class="custom-table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>STRENGTHS</th>
                    <th>WEAKNESSES</th>
                    <th>NEEDS</th>
                  </tr>
                </thead>
                <tbody className="tbody">
                  <tr style={{ textAlign: "left" }}>
                    <td>Patient</td>
                    <td>Avoid Conflct</td>
                    <td>Time</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Problem Solver</td>
                    <td>Procastination</td>
                    <td>Freedom</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Evalute Alternative</td>
                    <td>Rationalize</td>
                    <td>Alternatives</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Improvments</td>
                    <td>"Over-imporove"</td>
                    <td></td>
                  </tr>
                </tbody>
              </table> */}
              <div>
                <h3>Strengths and Weaknesses </h3>
                <p>
                  Your key strengths lie in your analytical abilities, accuracy,
                  and commitment to maintaining high standards. However, this
                  can also lead to rigidity, procrastination, and an overly
                  critical perspective that focuses too heavily on the past.{" "}
                </p>
              </div>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of control, the
                  opportunity to engage in precise and detailed work, and a
                  consistent environment that allows you to take the time needed
                  to thoroughly consider your decisions.{" "}
                </p>
              </div>
              <p>
                Overall, you are a thoughtful and cautious individual who values
                structure, predictability, and a methodical approach to tasks
                and projects. By understanding your personality traits and
                communication preferences, others can more effectively
                collaborate and work with you.
              </p>
            </div>
          </>
        );
      }
    }, []);

    useEffect(() => {
      const highestColor = getHighestColor();
      if (secondHighestColor === "red") {
        setIdentity2("Decision Makers, Goal Oriented, Result Driven");
        setFeedback2(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
            <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
              A cautious person, that tend to do all 'by the book', you analyze
              any situation before you commit to it, you look before you cross
              the street and walk before you run, your goal is to avoid to
              making the same mistake twice.
            </p> */}
            <h3> Result-Oriented and Driven </h3>
            <p>
              You are a highly driven and goal-oriented individual who is
              focused on achieving tangible results. You have a direct
              communication style and are confident in your abilities, often
              taking a competitive approach to tasks and projects.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                Direct Communication Style When communicating with you, it is
                best to be concise and to the point. You prefer clear and
                straightforward information, as you believe that people should
                already know what they are doing. You are a "bottom-line" person
                who values efficiency and getting things done.
              </p>
            </div>
            {/* <table class="custom-table">
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>STRENGTHS</th>
                  <th>WEAKNESSES</th>
                  <th>NEEDS</th>
                </tr>
              </thead>
              <tbody className="tbody">
                <tr style={{ textAlign: "left" }}>
                  <td>Patient</td>
                  <td>Avoid Conflct</td>
                  <td>Time</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Problem Solver</td>
                  <td>Procastination</td>
                  <td>Freedom</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Evalute Alternative</td>
                  <td>Rationalize</td>
                  <td>Alternatives</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Improvments</td>
                  <td>"Over-imporove"</td>
                  <td></td>
                </tr>
              </tbody>
            </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths lie in your ability to make decisions,
                achieve your goals, and take calculated risks. However, you may
                sometimes overlook the importance of caution and long-term
                considerations, focusing instead on short-term results.
                Additionally, you have a very high built-in sense of urgency.
                This allows you to make decisions and get results quickly, but
                can also cause frustration when working with others who don't
                have the same motor.
              </p>{" "}
            </div>
            <div>
              <h3>Needs and Motivations </h3>
              <p>
                To thrive, you require a sense of power, authority, and the
                ability to win. You are motivated by quantifiable achievements
                and the opportunity to demonstrate your competence and drive.{" "}
              </p>
            </div>
            <p>
              Overall, you are a highly capable and results-oriented individual
              who values direct communication, decision-making, and the
              achievement of your goals. By understanding your personality
              traits and communication preferences, others can more effectively
              collaborate and work with you.
            </p>
          </div>
        );
      } else if (secondHighestColor === "yellow") {
        setIdentity2("Communicators, Participants, Adaptable");
        setFeedback2(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3> Friendly, Outgoing, and Emotional</h3>
            <p>
              You are a vibrant and sociable individual who thrives on human
              connection and spontaneity. Your orientation is people-focused,
              with results taking a secondary priority. You are enthusiastic,
              expressive, and enjoy engaging in lively conversations.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is best to ask for your help and
                input. You appreciate being involved and valued for your unique
                perspective. Showcase your enthusiasm and excitement, and look
                for common ground that can foster a sense of camaraderie. Avoid
                getting bogged down in details, and instead focus on creating a
                positive and engaging atmosphere.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your strong communication skills,
                adaptability, and optimistic outlook. However, you may sometimes
                struggle with a lack of time management, difficulty following up
                on tasks, and a tendency to be overly subjective.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require recognition, acceptance, and
                  the opportunity to exert influence and be involved. You are
                  motivated by flexibility, options, and the chance to
                  participate actively in discussions and decision-making.
                </p>
              </div>
              <p>
                Overall, you are a vibrant and people-oriented individual who
                thrives on social interaction, enthusiasm, and a sense of
                belonging. By understanding your personality traits and
                communication preferences, others can more effectively engage
                and collaborate with you.
              </p>
            </div>
          </div>
        );
      } else if (secondHighestColor === "blue") {
        setIdentity2("Patient, Problem Solver, Good Listener");
        setFeedback2(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3> Sincere and Focused on Problem-Solving </h3>
            <p>
              You are a sincere and thoughtful individual who takes great pride
              in being a good listener and a problem-solver. Your focus is on
              making things better and maintaining harmony, often taking on the
              role of peacekeeper.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is important to ask for your
                input and opinions. You thrive when given the freedom to
                evaluate alternatives and choose the best course of action.
                Showing appreciation for your ideas and allowing you to
                contribute to the problem-solving process is key.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your ability to listen attentively,
                your patience, and your skill in evaluating alternatives and
                identifying improvements. However, you may sometimes struggle
                with conflict avoidance and procrastination, and can become
                overly focused on perfecting a solution.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of appreciation, the
                  freedom to explore options, and the time needed to thoroughly
                  consider and implement solutions. You are motivated by the
                  opportunity to make a positive impact and contribute to the
                  overall well-being of the group or organization.
                </p>
              </div>
              <p>
                Overall, you are a supportive and problem-solving oriented
                individual who values collaboration, consensus-building, and
                continuous improvement. By understanding your personality traits
                and communication preferences, others can more effectively
                engage and work with you.
              </p>
            </div>
          </div>
        );
      } else if (secondHighestColor === "green") {
        setIdentity2("Accurate, Consistent, Analytical");
        setFeedback2(
          <>
            <div>
              <h3> Analytical and Cautious </h3>
              <p>
                You are an analytical individual who values consistency,
                caution, and high standards. You carefully consider your
                decisions and actions, preferring to "look before you leap" in
                order to avoid repeating past mistakes.
              </p>
              <div>
                <h3>Communication Preferences </h3>
                <p>
                  When communicating with you, it is important to provide a
                  clear and structured approach, addressing the "how" rather
                  than just the "what." You thrive on predictability and
                  control, so presenting detailed information, facts, and
                  testimonials early on will help establish trust and
                  credibility.
                </p>
              </div>
              {/* <table class="custom-table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>STRENGTHS</th>
                    <th>WEAKNESSES</th>
                    <th>NEEDS</th>
                  </tr>
                </thead>
                <tbody className="tbody">
                  <tr style={{ textAlign: "left" }}>
                    <td>Patient</td>
                    <td>Avoid Conflct</td>
                    <td>Time</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Problem Solver</td>
                    <td>Procastination</td>
                    <td>Freedom</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Evalute Alternative</td>
                    <td>Rationalize</td>
                    <td>Alternatives</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Improvments</td>
                    <td>"Over-imporove"</td>
                    <td></td>
                  </tr>
                </tbody>
              </table> */}
              <div>
                <h3>Strengths and Weaknesses </h3>
                <p>
                  Your key strengths lie in your analytical abilities, accuracy,
                  and commitment to maintaining high standards. However, this
                  can also lead to rigidity, procrastination, and an overly
                  critical perspective that focuses too heavily on the past.{" "}
                </p>
              </div>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of control, the
                  opportunity to engage in precise and detailed work, and a
                  consistent environment that allows you to take the time needed
                  to thoroughly consider your decisions.{" "}
                </p>
              </div>
              <p>
                Overall, you are a thoughtful and cautious individual who values
                structure, predictability, and a methodical approach to tasks
                and projects. By understanding your personality traits and
                communication preferences, others can more effectively
                collaborate and work with you.
              </p>
            </div>
          </>
        );
      }
    }, []);

    useEffect(() => {
      const highestColor = getHighestColor();
      if (thirdHighestColor === "red") {
        setIdentity3("Decision Makers, Goal Oriented, Result Driven");
        setFeedback3(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
            <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
              A cautious person, that tend to do all 'by the book', you analyze
              any situation before you commit to it, you look before you cross
              the street and walk before you run, your goal is to avoid to
              making the same mistake twice.
            </p> */}
            <h3>Result-Oriented and Driven</h3>
            <p>
              You are a highly driven and goal-oriented individual who is
              focused on achieving tangible results. You have a direct
              communication style and are confident in your abilities, often
              taking a competitive approach to tasks and projects.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                Direct Communication Style When communicating with you, it is
                best to be concise and to the point. You prefer clear and
                straightforward information, as you believe that people should
                already know what they are doing. You are a "bottom-line" person
                who values efficiency and getting things done.
              </p>
            </div>
            {/* <table class="custom-table">
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>STRENGTHS</th>
                  <th>WEAKNESSES</th>
                  <th>NEEDS</th>
                </tr>
              </thead>
              <tbody className="tbody">
                <tr style={{ textAlign: "left" }}>
                  <td>Patient</td>
                  <td>Avoid Conflct</td>
                  <td>Time</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Problem Solver</td>
                  <td>Procastination</td>
                  <td>Freedom</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Evalute Alternative</td>
                  <td>Rationalize</td>
                  <td>Alternatives</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Improvments</td>
                  <td>"Over-imporove"</td>
                  <td></td>
                </tr>
              </tbody>
            </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths lie in your ability to make decisions,
                achieve your goals, and take calculated risks. However, you may
                sometimes overlook the importance of caution and long-term
                considerations, focusing instead on short-term results.
                Additionally, you have a very high built-in sense of urgency.
                This allows you to make decisions and get results quickly, but
                can also cause frustration when working with others who don't
                have the same motor.
              </p>{" "}
            </div>
            <div>
              <h3>Needs and Motivations </h3>
              <p>
                To thrive, you require a sense of power, authority, and the
                ability to win. You are motivated by quantifiable achievements
                and the opportunity to demonstrate your competence and drive.{" "}
              </p>
            </div>
            <p>
              Overall, you are a highly capable and results-oriented individual
              who values direct communication, decision-making, and the
              achievement of your goals. By understanding your personality
              traits and communication preferences, others can more effectively
              collaborate and work with you.
            </p>
          </div>
        );
      } else if (thirdHighestColor === "yellow") {
        setIdentity3("Communicators, Participants, Adaptable");
        setFeedback3(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3>Friendly, Outgoing, and Emotional</h3>
            <p>
              You are a vibrant and sociable individual who thrives on human
              connection and spontaneity. Your orientation is people-focused,
              with results taking a secondary priority. You are enthusiastic,
              expressive, and enjoy engaging in lively conversations.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is best to ask for your help and
                input. You appreciate being involved and valued for your unique
                perspective. Showcase your enthusiasm and excitement, and look
                for common ground that can foster a sense of camaraderie. Avoid
                getting bogged down in details, and instead focus on creating a
                positive and engaging atmosphere.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your strong communication skills,
                adaptability, and optimistic outlook. However, you may sometimes
                struggle with a lack of time management, difficulty following up
                on tasks, and a tendency to be overly subjective.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require recognition, acceptance, and
                  the opportunity to exert influence and be involved. You are
                  motivated by flexibility, options, and the chance to
                  participate actively in discussions and decision-making.
                </p>
              </div>
              <p>
                Overall, you are a vibrant and people-oriented individual who
                thrives on social interaction, enthusiasm, and a sense of
                belonging. By understanding your personality traits and
                communication preferences, others can more effectively engage
                and collaborate with you.
              </p>
            </div>
          </div>
        );
      } else if (thirdHighestColor === "blue") {
        setIdentity3("Patient, Problem Solver, Good Listener");
        setFeedback3(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3> Sincere and Focused on Problem-Solving </h3>
            <p>
              You are a sincere and thoughtful individual who takes great pride
              in being a good listener and a problem-solver. Your focus is on
              making things better and maintaining harmony, often taking on the
              role of peacekeeper.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is important to ask for your
                input and opinions. You thrive when given the freedom to
                evaluate alternatives and choose the best course of action.
                Showing appreciation for your ideas and allowing you to
                contribute to the problem-solving process is key.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your ability to listen attentively,
                your patience, and your skill in evaluating alternatives and
                identifying improvements. However, you may sometimes struggle
                with conflict avoidance and procrastination, and can become
                overly focused on perfecting a solution.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of appreciation, the
                  freedom to explore options, and the time needed to thoroughly
                  consider and implement solutions. You are motivated by the
                  opportunity to make a positive impact and contribute to the
                  overall well-being of the group or organization.
                </p>
              </div>
              <p>
                Overall, you are a supportive and problem-solving oriented
                individual who values collaboration, consensus-building, and
                continuous improvement. By understanding your personality traits
                and communication preferences, others can more effectively
                engage and work with you.
              </p>
            </div>
          </div>
        );
      } else if (thirdHighestColor === "green") {
        setIdentity3("Accurate, Consistent, Analytical");
        setFeedback3(
          <>
            <div>
              <h3> Analytical and Cautious </h3>
              <p>
                You are an analytical individual who values consistency,
                caution, and high standards. You carefully consider your
                decisions and actions, preferring to "look before you leap" in
                order to avoid repeating past mistakes.
              </p>
              <div>
                <h3>Communication Preferences </h3>
                <p>
                  When communicating with you, it is important to provide a
                  clear and structured approach, addressing the "how" rather
                  than just the "what." You thrive on predictability and
                  control, so presenting detailed information, facts, and
                  testimonials early on will help establish trust and
                  credibility.
                </p>
              </div>
              {/* <table class="custom-table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>STRENGTHS</th>
                    <th>WEAKNESSES</th>
                    <th>NEEDS</th>
                  </tr>
                </thead>
                <tbody className="tbody">
                  <tr style={{ textAlign: "left" }}>
                    <td>Patient</td>
                    <td>Avoid Conflct</td>
                    <td>Time</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Problem Solver</td>
                    <td>Procastination</td>
                    <td>Freedom</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Evalute Alternative</td>
                    <td>Rationalize</td>
                    <td>Alternatives</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Improvments</td>
                    <td>"Over-imporove"</td>
                    <td></td>
                  </tr>
                </tbody>
              </table> */}
              <div>
                <h3>Strengths and Weaknesses </h3>
                <p>
                  Your key strengths lie in your analytical abilities, accuracy,
                  and commitment to maintaining high standards. However, this
                  can also lead to rigidity, procrastination, and an overly
                  critical perspective that focuses too heavily on the past.{" "}
                </p>
              </div>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of control, the
                  opportunity to engage in precise and detailed work, and a
                  consistent environment that allows you to take the time needed
                  to thoroughly consider your decisions.{" "}
                </p>
              </div>
              <p>
                Overall, you are a thoughtful and cautious individual who values
                structure, predictability, and a methodical approach to tasks
                and projects. By understanding your personality traits and
                communication preferences, others can more effectively
                collaborate and work with you.
              </p>
            </div>
          </>
        );
      }
    }, []);

    useEffect(() => {
      const highestColor = getHighestColor();
      if (fourthHighestColor === "red") {
        setIdentity4("Decision Makers, Goal Oriented, Result Driven");
        setFeedback4(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
            <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
              A cautious person, that tend to do all 'by the book', you analyze
              any situation before you commit to it, you look before you cross
              the street and walk before you run, your goal is to avoid to
              making the same mistake twice.
            </p> */}
            <h3> Result-Oriented and Driven </h3>
            <p>
              You are a highly driven and goal-oriented individual who is
              focused on achieving tangible results. You have a direct
              communication style and are confident in your abilities, often
              taking a competitive approach to tasks and projects.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                Direct Communication Style When communicating with you, it is
                best to be concise and to the point. You prefer clear and
                straightforward information, as you believe that people should
                already know what they are doing. You are a "bottom-line" person
                who values efficiency and getting things done.
              </p>
            </div>
            {/* <table class="custom-table">
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>STRENGTHS</th>
                  <th>WEAKNESSES</th>
                  <th>NEEDS</th>
                </tr>
              </thead>
              <tbody className="tbody">
                <tr style={{ textAlign: "left" }}>
                  <td>Patient</td>
                  <td>Avoid Conflct</td>
                  <td>Time</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Problem Solver</td>
                  <td>Procastination</td>
                  <td>Freedom</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Evalute Alternative</td>
                  <td>Rationalize</td>
                  <td>Alternatives</td>
                </tr>
                <tr style={{ textAlign: "left" }}>
                  <td>Improvments</td>
                  <td>"Over-imporove"</td>
                  <td></td>
                </tr>
              </tbody>
            </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths lie in your ability to make decisions,
                achieve your goals, and take calculated risks. However, you may
                sometimes overlook the importance of caution and long-term
                considerations, focusing instead on short-term results.
                Additionally, you have a very high built-in sense of urgency.
                This allows you to make decisions and get results quickly, but
                can also cause frustration when working with others who don't
                have the same motor.
              </p>{" "}
            </div>
            <div>
              <h3>Needs and Motivations </h3>
              <p>
                To thrive, you require a sense of power, authority, and the
                ability to win. You are motivated by quantifiable achievements
                and the opportunity to demonstrate your competence and drive.{" "}
              </p>
            </div>
            <p>
              Overall, you are a highly capable and results-oriented individual
              who values direct communication, decision-making, and the
              achievement of your goals. By understanding your personality
              traits and communication preferences, others can more effectively
              collaborate and work with you.
            </p>
          </div>
        );
      } else if (fourthHighestColor === "yellow") {
        setIdentity4("Communicators, Participants, Adaptable");
        setFeedback4(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3> Friendly, Outgoing, and Emotional </h3>
            <p>
              You are a vibrant and sociable individual who thrives on human
              connection and spontaneity. Your orientation is people-focused,
              with results taking a secondary priority. You are enthusiastic,
              expressive, and enjoy engaging in lively conversations.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is best to ask for your help and
                input. You appreciate being involved and valued for your unique
                perspective. Showcase your enthusiasm and excitement, and look
                for common ground that can foster a sense of camaraderie. Avoid
                getting bogged down in details, and instead focus on creating a
                positive and engaging atmosphere.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your strong communication skills,
                adaptability, and optimistic outlook. However, you may sometimes
                struggle with a lack of time management, difficulty following up
                on tasks, and a tendency to be overly subjective.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require recognition, acceptance, and
                  the opportunity to exert influence and be involved. You are
                  motivated by flexibility, options, and the chance to
                  participate actively in discussions and decision-making.
                </p>
              </div>
              <p>
                Overall, you are a vibrant and people-oriented individual who
                thrives on social interaction, enthusiasm, and a sense of
                belonging. By understanding your personality traits and
                communication preferences, others can more effectively engage
                and collaborate with you.
              </p>
            </div>
          </div>
        );
      } else if (fourthHighestColor === "blue") {
        setIdentity4("Patient, Problem Solver, Good Listener");
        setFeedback4(
          <div>
            {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
          <p>Your major strength is associated with {correspondingColor}!</p> */}
            {/* <p>
            A cautious person, that tend to do all 'by the book', you analyze
            any situation before you commit to it, you look before you cross
            the street and walk before you run, your goal is to avoid to
            making the same mistake twice.
          </p> */}
            <h3>Sincere and Focused on Problem-Solving</h3>
            <p>
              You are a sincere and thoughtful individual who takes great pride
              in being a good listener and a problem-solver. Your focus is on
              making things better and maintaining harmony, often taking on the
              role of peacekeeper.
            </p>
            <div>
              <h3>Communication Preferences </h3>
              <p>
                When communicating with you, it is important to ask for your
                input and opinions. You thrive when given the freedom to
                evaluate alternatives and choose the best course of action.
                Showing appreciation for your ideas and allowing you to
                contribute to the problem-solving process is key.
              </p>
            </div>
            {/* <table class="custom-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>STRENGTHS</th>
                <th>WEAKNESSES</th>
                <th>NEEDS</th>
              </tr>
            </thead>
            <tbody className="tbody">
              <tr style={{ textAlign: "left" }}>
                <td>Patient</td>
                <td>Avoid Conflct</td>
                <td>Time</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Problem Solver</td>
                <td>Procastination</td>
                <td>Freedom</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Evalute Alternative</td>
                <td>Rationalize</td>
                <td>Alternatives</td>
              </tr>
              <tr style={{ textAlign: "left" }}>
                <td>Improvments</td>
                <td>"Over-imporove"</td>
                <td></td>
              </tr>
            </tbody>
          </table> */}
            <div>
              <h3>Strengths and Weaknesses </h3>
              <p>
                Your key strengths include your ability to listen attentively,
                your patience, and your skill in evaluating alternatives and
                identifying improvements. However, you may sometimes struggle
                with conflict avoidance and procrastination, and can become
                overly focused on perfecting a solution.
              </p>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of appreciation, the
                  freedom to explore options, and the time needed to thoroughly
                  consider and implement solutions. You are motivated by the
                  opportunity to make a positive impact and contribute to the
                  overall well-being of the group or organization.
                </p>
              </div>
              <p>
                Overall, you are a supportive and problem-solving oriented
                individual who values collaboration, consensus-building, and
                continuous improvement. By understanding your personality traits
                and communication preferences, others can more effectively
                engage and work with you.
              </p>
            </div>
          </div>
        );
      } else if (fourthHighestColor === "green") {
        setIdentity4("Accurate, Consistent, Analytical");
        setFeedback4(
          <>
            <div>
              <h3>Analytical and Cautious</h3>
              <p>
                You are an analytical individual who values consistency,
                caution, and high standards. You carefully consider your
                decisions and actions, preferring to "look before you leap" in
                order to avoid repeating past mistakes.
              </p>
              <div>
                <h3>Communication Preferences </h3>
                <p>
                  When communicating with you, it is important to provide a
                  clear and structured approach, addressing the "how" rather
                  than just the "what." You thrive on predictability and
                  control, so presenting detailed information, facts, and
                  testimonials early on will help establish trust and
                  credibility.
                </p>
              </div>
              {/* <table class="custom-table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>STRENGTHS</th>
                    <th>WEAKNESSES</th>
                    <th>NEEDS</th>
                  </tr>
                </thead>
                <tbody className="tbody">
                  <tr style={{ textAlign: "left" }}>
                    <td>Patient</td>
                    <td>Avoid Conflct</td>
                    <td>Time</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Problem Solver</td>
                    <td>Procastination</td>
                    <td>Freedom</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Evalute Alternative</td>
                    <td>Rationalize</td>
                    <td>Alternatives</td>
                  </tr>
                  <tr style={{ textAlign: "left" }}>
                    <td>Improvments</td>
                    <td>"Over-imporove"</td>
                    <td></td>
                  </tr>
                </tbody>
              </table> */}
              <div>
                <h3>Strengths and Weaknesses </h3>
                <p>
                  Your key strengths lie in your analytical abilities, accuracy,
                  and commitment to maintaining high standards. However, this
                  can also lead to rigidity, procrastination, and an overly
                  critical perspective that focuses too heavily on the past.{" "}
                </p>
              </div>
              <div>
                <h3>Needs and Motivations </h3>
                <p>
                  To feel fulfilled, you require a sense of control, the
                  opportunity to engage in precise and detailed work, and a
                  consistent environment that allows you to take the time needed
                  to thoroughly consider your decisions.{" "}
                </p>
              </div>
              <p>
                Overall, you are a thoughtful and cautious individual who values
                structure, predictability, and a methodical approach to tasks
                and projects. By understanding your personality traits and
                communication preferences, others can more effectively
                collaborate and work with you.
              </p>
            </div>
          </>
        );
      }
    }, []);

    // useEffect(() => {
    //   const timer = setTimeout(() => {
    //     setShowResultsFinal(true);
    //   }, 10000); // 7 seconds delay

    //   return () => clearTimeout(timer); // Cleanup timeout on unmount
    // }, []);

    return (
      <div className="feedbackCol">
        <h2>Total Result</h2>
        <div className="container mx-auto p-4">
            <div className="custom-box colorBox">
              <table className="min-w-full border-collapse border border-gray-300 mb-4">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">
                      Color
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left"></th>
                    <th className="border border-gray-300 px-4 py-2 text-left">
                      Profile
                    </th>
                    <th className="border border-gray-300 px-4 py-2 text-left">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCombined.map((color, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">
                        {color.name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <div
                          style={{
                            backgroundColor: color.code,
                            width: "30px",
                            height: "30px",
                            borderRadius: "4px",
                          }}
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 profileHead">
                        {color.value}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {color.result}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          
        </div>

        {/* Feedback Section */}
        <div
          className="custom-box feedbackColTable"
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "5px",
            backgroundColor: "#f9f9f9",
            marginTop: "40px",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }}
            className="text-lg font-bold"
          >
            {/* Feedback for {identity}{" "} */}
          </h3>
          {feedback}
        </div>

        <div
          className="custom-box feedbackColTable"
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "5px",
            backgroundColor: "#f9f9f9",
            marginTop: "40px",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }}
            className="text-lg font-bold"
          >
            {/* Feedback for {identity2}{" "} */}
          </h3>
          {feedback2}
        </div>

        <div
          className="custom-box feedbackColTable"
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "5px",
            backgroundColor: "#f9f9f9",
            marginTop: "40px",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }}
            className="text-lg font-bold"
          >
            {/* Feedback for {identity3}{" "} */}
          </h3>
          {feedback3}
        </div>

        <div
          className="custom-box feedbackColTable"
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "5px",
            backgroundColor: "#f9f9f9",
            marginTop: "40px",
            marginBottom: "100px",
          }}
        >
          <h3
            style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }}
            className="text-lg font-bold"
          >
            {/* Feedback for {identity4}{" "} */}
          </h3>
          {feedback4}
        </div>
      </div>
    );
  };

  const ColorFeedback2 = () => {
    // const [feedback2, setFeedback2] = useState('');

    const colors = [
      {
        name: "Red",
        value: "Taking Action",
        code: "#FF0000",
        result: adultResult[0],
      },
      {
        name: "Yellow",
        value: "Talking",
        code: "#FFFF00",
        result: adultResult[1],
      },
      {
        name: "Blue",
        value: "Thinking",
        code: "#0000FF",
        result: adultResult[2],
      },
      {
        name: "Green",
        value: "Checking & Analyzing",
        code: "#00FF00",
        result: adultResult[3],
      },
    ];

    const sortedColors = [...colors].sort((a, b) => b.result - a.result);

    // Helper function to convert hex color to an integer value
    const hexToInt = (hex) => parseInt(hex.slice(1), 16);

    // Find the color with the highest value
    const getHighestColor = () =>
      colors.reduce((max, color) =>
        hexToInt(color.value) > hexToInt(max.value) ? color : max
      );

    // Generate feedback message based on the highest color value
    // useEffect(() => {
    //   const highestColor = getHighestColor();
    //   if (correspondingColor === 'red') {
    //     setIdentity("Decision Makers, Goal Oriented, Result Driven")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are result Oriented and driven, Direct to the point, confident and competitve and you are always in a hurray.</p>
    //         <div>
    //           <h3>How To Communicate: Tell them WHAT</h3>
    //           <p>Be direct and concise, Reds think they should know what they are doing, therefore, they like to work with people who know what they are doing, Tell them the WHAT and forget the rest of the story. These are the "bottom line" people. </p>
    //         </div>
    //         <table className
    //           ="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Get Results</td>
    //               <td data-label="WEAKNESSES">Not Cautious</td>
    //               <td data-label="NEEDS">Power</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Decision Makers</td>
    //               <td data-label="WEAKNESSES">Run Over People</td>
    //               <td data-label="NEEDS">Authority</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Achieve Goals</td>
    //               <td data-label="WEAKNESSES">Focus On Short Term Results</td>
    //               <td data-label="NEEDS">To win</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Risk Takers</td>
    //               <td data-label="WEAKNESSES">Focus On Wrong Thing</td>
    //               <td data-label="NEEDS">Quantifiable Results</td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'yellow') {
    //     setIdentity("Communicators, Participants, Adaptable")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are friendly, outgoing and emotional. Your orientation is people first, results second. You like to combine food with talk, and you talk a lot. You are very spontaneous.</p>
    //         <div>
    //           <h3>How To Communicate: Ask for their HELP</h3>
    //           <p>Be direct and concise, Reds think they should know what they are doing, therefore, they like to work with people who know what they are doing, Tell them the WHAT and forget the rest of the story. These are the "bottom line" people. </p>
    //         </div>
    //         <table className
    //           ="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Communicators</td>
    //               <td>No Sense of Time</td>
    //               <td>Recognition</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Participants</td>
    //               <td>Lack Follow-Up</td>
    //               <td>Acceptance</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Adaptability</td>
    //               <td>Lack Objectivity</td>
    //               <td>Influence</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Optimistic</td>
    //               <td>Chamelon</td>
    //               <td>Involvement</td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'blue') {
    //     setIdentity("Patient, Problem Solver, Good Listener")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are a sincere person and good Listener, a problem solver and peace keeper. You are appreciated for who you are, not what you do. You focus on how to make things better</p>
    //         <div>
    //           <h3>How To Communicate: Ask what they THINK</h3>
    //           <p>They want to have input, Provide alternatives and allow them the freedom to choose the best one. Show appreciation for their ideas and input. ASK them what they think about your idea. Give them a problem to solve- they think yhey should know how!</p>
    //         </div>
    //         <table class="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Patient</td>
    //               <td>Avoid Conflct</td>
    //               <td>Time</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Problem Solver</td>
    //               <td>Procastination</td>
    //               <td>Freedom</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Evalute Alternative</td>
    //               <td>Rationalize</td>
    //               <td>Alternatives</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Improvments</td>
    //               <td>"Over-imporove"</td>
    //               <td></td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'green') {
    //     setIdentity("Accurate, Consistent, Analytical")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>A cautious person, that tend to do all 'by the book', you analyze any situation before you commit to it, you look before you cross the street and walk before you run, your goal is to avoid to making the same mistake twice.</p>
    //         <div>
    //           <h3>How To Communicate: Tell them HOW you want it done</h3>
    //           <p>They need consistency, predictablility and control. They want to see proff. Use testimonials. Lay the facts out early. Tell them the bad news first. Make a formal presentation and answer all the HOW question.</p>
    //         </div>
    //         <table class="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESSES</th>
    //               <th>M=NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Patient</td>
    //               <td>Avoid Conflct</td>
    //               <td>Time</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Problem Solver</td>
    //               <td>Procastination</td>
    //               <td>Freedom</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Evalute Alternative</td>
    //               <td>Rationalize</td>
    //               <td>Alternatives</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Improvments</td>
    //               <td>"Over-imporove"</td>
    //               <td></td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   }
    // }, []);

    return (
      <div className="feedbackCol">
        <h2>What You Prefer To Do/How You Are Effective</h2>
        <div className="container mx-auto p-4 custom-box colorBox">
          {/* <h1 className="text-2xl font-bold mb-4">Color List</h1> */}
          <table
            className="min-w-full border-collapse border border-gray-300 mb-4"
          // style={{
          //   border: '1px solid #ccc',
          //   padding: '20px',
          //   borderRadius: '5px',
          //   backgroundColor: '#f9f9f9',
          //   marginTop: "40px"
          // }}
          >
            <thead>
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Color
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left"></th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Profile
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedColors.map((color, index) => (
                <tr key={index} className="">
                  <td className="border border-gray-300 px-4 py-2">
                    {color.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <div
                      style={{
                        backgroundColor: color.code,
                        width: "30px",
                        height: "30px",
                        borderRadius: "4px",
                      }}
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 profileHead">
                    {color.value}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {color.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Feedback Section */}
        {/* <div
          className="custom-box"
          style={{
            border: '1px solid #ccc',
            padding: '20px',
            borderRadius: '5px',
            backgroundColor: '#f9f9f9',
            marginTop: "40px"
          }}
        >
          <h3 style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }} className="text-lg font-bold">Feedback for {identity} </h3>
          {feedback2}
        </div> */}
      </div>
    );
  };

  const ColorFeedback3 = () => {
    // const [feedback2, setFeedback2] = useState('');

    const colors = [
      {
        name: "Red",
        value: "Taking Action",
        code: "#FF0000",
        result: childResult[0],
      },
      {
        name: "Yellow",
        value: "Influencing",
        code: "#FFFF00",
        result: childResult[1],
      },
      {
        name: "Blue",
        value: "Thinking",
        code: "#0000FF",
        result: childResult[2],
      },
      {
        name: "Green",
        value: "Maintaining",
        code: "#00FF00",
        result: childResult[3],
      },
    ];

    const sortedColors = [...colors].sort((a, b) => b.result - a.result);
    console.log("total result color, ", sortedColors)

    // Helper function to convert hex color to an integer value
    const hexToInt = (hex) => parseInt(hex.slice(1), 16);

    // Find the color with the highest value
    const getHighestColor = () =>
      colors.reduce((max, color) =>
        hexToInt(color.value) > hexToInt(max.value) ? color : max
      );

    // Generate feedback message based on the highest color value
    // useEffect(() => {
    //   const highestColor = getHighestColor();
    //   if (correspondingColor === 'red') {
    //     setIdentity("Decision Makers, Goal Oriented, Result Driven")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are result Oriented and driven, Direct to the point, confident and competitve and you are always in a hurray.</p>
    //         <div>
    //           <h3>How To Communicate: Tell them WHAT</h3>
    //           <p>Be direct and concise, Reds think they should know what they are doing, therefore, they like to work with people who know what they are doing, Tell them the WHAT and forget the rest of the story. These are the "bottom line" people. </p>
    //         </div>
    //         <table className
    //           ="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Get Results</td>
    //               <td data-label="WEAKNESSES">Not Cautious</td>
    //               <td data-label="NEEDS">Power</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Decision Makers</td>
    //               <td data-label="WEAKNESSES">Run Over People</td>
    //               <td data-label="NEEDS">Authority</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Achieve Goals</td>
    //               <td data-label="WEAKNESSES">Focus On Short Term Results</td>
    //               <td data-label="NEEDS">To win</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Risk Takers</td>
    //               <td data-label="WEAKNESSES">Focus On Wrong Thing</td>
    //               <td data-label="NEEDS">Quantifiable Results</td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'yellow') {
    //     setIdentity("Communicators, Participants, Adaptable")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are friendly, outgoing and emotional. Your orientation is people first, results second. You like to combine food with talk, and you talk a lot. You are very spontaneous.</p>
    //         <div>
    //           <h3>How To Communicate: Ask for their HELP</h3>
    //           <p>Be direct and concise, Reds think they should know what they are doing, therefore, they like to work with people who know what they are doing, Tell them the WHAT and forget the rest of the story. These are the "bottom line" people. </p>
    //         </div>
    //         <table className
    //           ="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Communicators</td>
    //               <td>No Sense of Time</td>
    //               <td>Recognition</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Participants</td>
    //               <td>Lack Follow-Up</td>
    //               <td>Acceptance</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Adaptability</td>
    //               <td>Lack Objectivity</td>
    //               <td>Influence</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Optimistic</td>
    //               <td>Chamelon</td>
    //               <td>Involvement</td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'blue') {
    //     setIdentity("Patient, Problem Solver, Good Listener")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are a sincere person and good Listener, a problem solver and peace keeper. You are appreciated for who you are, not what you do. You focus on how to make things better</p>
    //         <div>
    //           <h3>How To Communicate: Ask what they THINK</h3>
    //           <p>They want to have input, Provide alternatives and allow them the freedom to choose the best one. Show appreciation for their ideas and input. ASK them what they think about your idea. Give them a problem to solve- they think yhey should know how!</p>
    //         </div>
    //         <table class="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Patient</td>
    //               <td>Avoid Conflct</td>
    //               <td>Time</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Problem Solver</td>
    //               <td>Procastination</td>
    //               <td>Freedom</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Evalute Alternative</td>
    //               <td>Rationalize</td>
    //               <td>Alternatives</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Improvments</td>
    //               <td>"Over-imporove"</td>
    //               <td></td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'green') {
    //     setIdentity("Accurate, Consistent, Analytical")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>A cautious person, that tend to do all 'by the book', you analyze any situation before you commit to it, you look before you cross the street and walk before you run, your goal is to avoid to making the same mistake twice.</p>
    //         <div>
    //           <h3>How To Communicate: Tell them HOW you want it done</h3>
    //           <p>They need consistency, predictablility and control. They want to see proff. Use testimonials. Lay the facts out early. Tell them the bad news first. Make a formal presentation and answer all the HOW question.</p>
    //         </div>
    //         <table class="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESSES</th>
    //               <th>M=NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Patient</td>
    //               <td>Avoid Conflct</td>
    //               <td>Time</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Problem Solver</td>
    //               <td>Procastination</td>
    //               <td>Freedom</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Evalute Alternative</td>
    //               <td>Rationalize</td>
    //               <td>Alternatives</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Improvments</td>
    //               <td>"Over-imporove"</td>
    //               <td></td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   }
    // }, []);

    return (
      <div className="feedbackCol">
        <h2>How You React Under Stress</h2>
        <div className="container mx-auto p-4 custom-box colorBox">
          {/* <h1 className="text-2xl font-bold mb-4">Color List</h1> */}
          <table
            className="min-w-full border-collapse border border-gray-300 mb-4"
          // style={{
          //   border: '1px solid #ccc',
          //   padding: '20px',
          //   borderRadius: '5px',
          //   backgroundColor: '#f9f9f9',
          //   marginTop: "40px"
          // }}
          >
            <thead>
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Color
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left"></th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Profile
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedColors.map((color, index) => (
                <tr key={index} className="">
                  <td className="border border-gray-300 px-4 py-2">
                    {color.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <div
                      style={{
                        backgroundColor: color.code,
                        width: "30px",
                        height: "30px",
                        borderRadius: "4px",
                      }}
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 profileHead">
                    {color.value}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {color.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Feedback Section */}
        {/* <div
          className="custom-box"
          style={{
            border: '1px solid #ccc',
            padding: '20px',
            borderRadius: '5px',
            backgroundColor: '#f9f9f9',
            marginTop: "40px"
          }}
        >
          <h3 style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }} className="text-lg font-bold">Feedback for {identity} </h3>
          {feedback2}
        </div> */}
      </div>
    );
  };

  const ColorFeedback4 = () => {
    // const [feedback2, setFeedback2] = useState('');

    const colors = [
      {
        name: "Red",
        value: "Taking Action",
        code: "#FF0000",
        result: parentResult[0],
      },
      {
        name: "Yellow",
        value: "Influencing",
        code: "#FFFF00",
        result: parentResult[1],
      },
      {
        name: "Blue",
        value: "Thinking",
        code: "#0000FF",
        result: parentResult[2],
      },
      {
        name: "Green",
        value: "Maintaining",
        code: "#00FF00",
        result: parentResult[3],
      },
    ];

    const sortedColors = [...colors].sort((a, b) => b.result - a.result);

    // Helper function to convert hex color to an integer value
    const hexToInt = (hex) => parseInt(hex.slice(1), 16);

    // Find the color with the highest value
    const getHighestColor = () =>
      colors.reduce((max, color) =>
        hexToInt(color.value) > hexToInt(max.value) ? color : max
      );

    // Generate feedback message based on the highest color value
    // useEffect(() => {
    //   const highestColor = getHighestColor();
    //   if (correspondingColor === 'red') {
    //     setIdentity("Decision Makers, Goal Oriented, Result Driven")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are result Oriented and driven, Direct to the point, confident and competitve and you are always in a hurray.</p>
    //         <div>
    //           <h3>How To Communicate: Tell them WHAT</h3>
    //           <p>Be direct and concise, Reds think they should know what they are doing, therefore, they like to work with people who know what they are doing, Tell them the WHAT and forget the rest of the story. These are the "bottom line" people. </p>
    //         </div>
    //         <table className
    //           ="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Get Results</td>
    //               <td data-label="WEAKNESSES">Not Cautious</td>
    //               <td data-label="NEEDS">Power</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Decision Makers</td>
    //               <td data-label="WEAKNESSES">Run Over People</td>
    //               <td data-label="NEEDS">Authority</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Achieve Goals</td>
    //               <td data-label="WEAKNESSES">Focus On Short Term Results</td>
    //               <td data-label="NEEDS">To win</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td data-label="STRENGTHS">Risk Takers</td>
    //               <td data-label="WEAKNESSES">Focus On Wrong Thing</td>
    //               <td data-label="NEEDS">Quantifiable Results</td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'yellow') {
    //     setIdentity("Communicators, Participants, Adaptable")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are friendly, outgoing and emotional. Your orientation is people first, results second. You like to combine food with talk, and you talk a lot. You are very spontaneous.</p>
    //         <div>
    //           <h3>How To Communicate: Ask for their HELP</h3>
    //           <p>Be direct and concise, Reds think they should know what they are doing, therefore, they like to work with people who know what they are doing, Tell them the WHAT and forget the rest of the story. These are the "bottom line" people. </p>
    //         </div>
    //         <table className
    //           ="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Communicators</td>
    //               <td>No Sense of Time</td>
    //               <td>Recognition</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Participants</td>
    //               <td>Lack Follow-Up</td>
    //               <td>Acceptance</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Adaptability</td>
    //               <td>Lack Objectivity</td>
    //               <td>Influence</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Optimistic</td>
    //               <td>Chamelon</td>
    //               <td>Involvement</td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'blue') {
    //     setIdentity("Patient, Problem Solver, Good Listener")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>You are a sincere person and good Listener, a problem solver and peace keeper. You are appreciated for who you are, not what you do. You focus on how to make things better</p>
    //         <div>
    //           <h3>How To Communicate: Ask what they THINK</h3>
    //           <p>They want to have input, Provide alternatives and allow them the freedom to choose the best one. Show appreciation for their ideas and input. ASK them what they think about your idea. Give them a problem to solve- they think yhey should know how!</p>
    //         </div>
    //         <table class="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESS</th>
    //               <th>NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Patient</td>
    //               <td>Avoid Conflct</td>
    //               <td>Time</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Problem Solver</td>
    //               <td>Procastination</td>
    //               <td>Freedom</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Evalute Alternative</td>
    //               <td>Rationalize</td>
    //               <td>Alternatives</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Improvments</td>
    //               <td>"Over-imporove"</td>
    //               <td></td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   } else if (correspondingColor === 'green') {
    //     setIdentity("Accurate, Consistent, Analytical")
    //     setFeedback(
    //       <div>
    //         {/* 🎨 The color with the highest value is <strong>{correspondingColor}</strong> ({maxValue}).
    //         <p>Your major strength is associated with {correspondingColor}!</p> */}
    //         <p>A cautious person, that tend to do all 'by the book', you analyze any situation before you commit to it, you look before you cross the street and walk before you run, your goal is to avoid to making the same mistake twice.</p>
    //         <div>
    //           <h3>How To Communicate: Tell them HOW you want it done</h3>
    //           <p>They need consistency, predictablility and control. They want to see proff. Use testimonials. Lay the facts out early. Tell them the bad news first. Make a formal presentation and answer all the HOW question.</p>
    //         </div>
    //         <table class="custom-table">
    //           <thead>
    //             <tr style={{ textAlign: "left" }}>
    //               <th>STRENGTHS</th>
    //               <th>WEAKNESSES</th>
    //               <th>M=NEEDS</th>
    //             </tr>
    //           </thead>
    //           <tbody className="tbody">
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Patient</td>
    //               <td>Avoid Conflct</td>
    //               <td>Time</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Problem Solver</td>
    //               <td>Procastination</td>
    //               <td>Freedom</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Evalute Alternative</td>
    //               <td>Rationalize</td>
    //               <td>Alternatives</td>
    //             </tr>
    //             <tr style={{ textAlign: "left" }}>
    //               <td>Improvments</td>
    //               <td>"Over-imporove"</td>
    //               <td></td>
    //             </tr>
    //           </tbody>
    //         </table>
    //       </div>
    //     );
    //   }
    // }, []);

    return (
      <div className="feedbackCol">
        <h2>What You Feel You Ought to Do/How You Should Think</h2>
        <div className="container mx-auto p-4 custom-box colorBox">
          {/* <h1 className="text-2xl font-bold mb-4">Color List</h1> */}
          <table
            className="min-w-full border-collapse border border-gray-300 mb-4"
          // style={{
          //   border: '1px solid #ccc',
          //   padding: '20px',
          //   borderRadius: '5px',
          //   backgroundColor: '#f9f9f9',
          //   marginTop: "40px"
          // }}
          >
            <thead>
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Color
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left"></th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Profile
                </th>
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedColors.map((color, index) => (
                <tr key={index} className="">
                  <td className="border border-gray-300 px-4 py-2">
                    {color.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <div
                      style={{
                        backgroundColor: color.code,
                        width: "30px",
                        height: "30px",
                        borderRadius: "4px",
                      }}
                    />
                  </td>
                  <td className="border border-gray-300 px-4 py-2 profileHead">
                    {color.value}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {color.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Feedback Section */}
        {/* <div
          className="custom-box"
          style={{
            border: '1px solid #ccc',
            padding: '20px',
            borderRadius: '5px',
            backgroundColor: '#f9f9f9',
            marginTop: "40px"
          }}
        >
          <h3 style={{ color: "#16133d", fontSize: "24px", fontWeight: "bolder" }} className="text-lg font-bold">Feedback for {identity} </h3>
          {feedback2}
        </div> */}
      </div>
    );
  };

  const extractFirst20Weights = () => {
    // Flatten all questions across sections
    const allQuestions = questionsUpdate.flatMap(
      (section) => section.questions
    );

    // Get the first 20 questions (use slice with positive arguments)
    const first20Questions = allQuestions.slice(0, 20);

    // Extract their IDs
    const first20QuestionIds = first20Questions.map((q) => q.id);

    // Filter answers for these IDs and calculate weights
    const first20Weights = first20QuestionIds
      .map((id) => {
        const question = allQuestions.find((q) => q.id === id);
        const selectedOption = answers[id];
        const option = question?.options.find(
          (opt) => opt.text === selectedOption
        );

        return option?.weight || 0; // Return weight if exists, otherwise 0
      })
      .filter((weight) => weight !== 0); // Filter out any invalid weights

    return first20Weights;
  };

  const extractMiddle20Weights = () => {
    // Flatten all questions across sections
    const allQuestions = questionsUpdate.flatMap(
      (section) => section.questions
    );

    // Calculate the middle range
    const totalQuestions = allQuestions.length;
    const startIndex = Math.floor((totalQuestions - 20) / 2); // Middle start index
    const middle20Questions = allQuestions.slice(startIndex, startIndex + 20);

    // Extract their IDs
    const middle20QuestionIds = middle20Questions.map((q) => q.id);

    // Filter answers for these IDs and calculate weights
    const middle20Weights = middle20QuestionIds
      .map((id) => {
        const question = allQuestions.find((q) => q.id === id);
        const selectedOption = answers[id];
        const option = question?.options.find(
          (opt) => opt.text === selectedOption
        );

        return option?.weight || 0; // Return weight if exists, otherwise 0
      })
      .filter((weight) => weight !== 0); // Filter out any invalid weights

    return middle20Weights;
  };

  const extractLast20Weights = () => {
    // Flatten all questions across sections
    const allQuestions = questionsUpdate.flatMap(
      (section) => section.questions
    );

    // Get the last 20 questions
    const last20Questions = allQuestions.slice(-20);

    // Extract their IDs
    const last20QuestionIds = last20Questions.map((q) => q.id);

    // Filter answers for these IDs and calculate weights
    const last20Weights = last20QuestionIds
      .map((id) => {
        const question = allQuestions.find((q) => q.id === id);
        const selectedOption = answers[id];
        const option = question?.options.find(
          (opt) => opt.text === selectedOption
        );

        return option?.weight || 0; // Return weight if exists, otherwise 0
      })
      .filter((weight) => weight !== 0); // Filter out any invalid weights

    return last20Weights;
  };

  // Call the function and store the result when needed
  const last20Weights = extractLast20Weights();
  const first20Weights = extractFirst20Weights();
  const middle20Weights = extractMiddle20Weights();
  console.log("first 20 Question Weights:", first20Weights);
  console.log("middle 20 Question Weights:", middle20Weights);
  console.log("Last 20 Question Weights:", last20Weights);

  const childResult = ["A", "B", "C", "D"].map(
    (value) => first20Weights.filter((item) => item === value).length
  );

  const adultResult = ["A", "B", "C", "D"].map(
    (value) => last20Weights.filter((item) => item === value).length
  );

  const parentResult = ["A", "B", "C", "D"].map(
    (value) => middle20Weights.filter((item) => item === value).length
  );


  console.log("child", childResult);
  console.log("parent", parentResult);
  console.log("adult", adultResult);

  useEffect(() => {
    setChildValue(childResult);
    setParentValue(parentResult);
    setAdultValue(adultResult);
  }, []);

  console.log(valuesArray);
  console.log(colorsArray);

  // Color assignment based on index
  const resultColors = ['red', 'yellow', 'blue', 'green'];
  const childResultProfile = ["Taking Action", "Influencing", "Thinking", "Maintaining"]
  const parentResultProfile = ["Taking Action", "Influencing", "Thinking", "Maintaining"]
  const adultResultProfile = ["Taking Action", "Talking", "Thinking", "Checking & Analyzing"]

  // Create a function to assign colors to each array
  function assignColors(array) {
    return array.map((value, index) => ({
      value: value,
      color: resultColors[index]
    }));
  }

  function assignPdfColors(array) {
    return array.map((value, index) => ({
      value: value,
      color: resultColors[index],
      profile: childResultProfile[index]
    }));
  }

  function assignPdfColors2(array) {
    return array.map((value, index) => ({
      value: value,
      color: resultColors[index],
      profile: adultResultProfile[index]
    }));
  }

  // Creating new arrays with assigned colors
  const childWithColors = assignColors(childResult);
  const parentWithColors = assignColors(parentResult);
  const adultWithColors = assignColors(adultResult);

  const childWithColorsPdf = assignPdfColors(childResult);
  const parentWithColorsPdf = assignPdfColors(parentResult);
  const adultWithColorsPdf = assignPdfColors2(adultResult);

  // setChildPdfValue(childWithColorsPdf)
  // setParentPdfValue(parentWithColorsPdf)
  // setAdultPdfValue(adultWithColorsPdf)

  console.log('Child Array with Colors:', childWithColorsPdf);
  console.log('Parent Array with Colors:', parentWithColorsPdf);
  console.log('Adult Array with Colors:', adultWithColorsPdf);

  // Mapping of colors to the desired names, descriptions, and codes
  const colorMapping = {
    red: { name: 'Red', value: 'Decision Makers, Goal Oriented, Results', code: '#FF0000' },
    yellow: { name: 'Yellow', value: 'Communicators, Participants, Adaptable', code: '#FFFF00' },
    blue: { name: 'Blue', value: 'Problem Solver, Good Listener', code: '#0000FF' },
    green: { name: 'Green', value: 'Accurate, Consistent, Analytical', code: '#00FF00' }
  };

  // Function to combine the arrays according to the index positions
  function combineArrays(child, parent, adult) {
    const combined = [];

    for (let i = 0; i < child.length; i++) {
      const color = child[i].color;  // Assuming child, parent, and adult arrays are aligned by index
      const result = child[i].value + parent[i].value + adult[i].value; // Summing the values for the result

      const colorInfo = colorMapping[color];
      combined.push({
        name: colorInfo.name,
        value: colorInfo.value,
        code: colorInfo.code,
        result: result
      });
    }

    return combined;
  }

  // Generate the combined array
  const finalArray = combineArrays(childWithColors, parentWithColors, adultWithColors);
  const sortedCombined = finalArray.sort((a, b) => b.result - a.result);
  console.log("newstest", sortedCombined);

  /** 
  const rows = [
    childResult,
    parentResult,
    adultResult
  ];

  // Colors in the specified order
  const colorsAss = ["Red", "Yellow", "Blue", "Green"];

  // Initialize an object to store the totals
  const totals = { Red: 0, Yellow: 0, Blue: 0, Green: 0 };

  // Sum the values column-wise and assign to the respective colors
  rows.forEach(row => {
    row.forEach((value, index) => {
      totals[colorsAss[index]] += value;
    });
  });

  // setTotals(totals); 

  console.log("summed total =", totals)

  **/

  useEffect(() => {
    const rows = [childResult, parentResult, adultResult];

    // Colors in the specified order and their attributes
    const colorAttributes = {
      Red: {
        code: "#FF0000",
        name: "Red",
        value: "Decision Makers, Goal Oriented, Results",
      },
      Yellow: {
        code: "#FFFF00",
        name: "Yellow",
        value: "Communicators, Participants, Adaptable",
      },
      Blue: {
        code: "#0000FF",
        name: "Blue",
        value: "Problem Solver, Good Listener",
      },
      Green: {
        code: "#00FF00",
        name: "Green",
        value: "Accurate, Consistent, Analytical",
      },
    };

    // Initialize an array to store the results
    const results = [
      { ...colorAttributes.Red, result: 0 },
      { ...colorAttributes.Yellow, result: 0 },
      { ...colorAttributes.Blue, result: 0 },
      { ...colorAttributes.Green, result: 0 },
    ];

    // Sum the values column-wise and assign to the respective colors
    rows.forEach((row) => {
      row.forEach((value, index) => {
        results[index].result += value;
      });
    });

    // Optional: Sort the results in descending order
    results.sort((a, b) => b.result - a.result);
    // Set the final results state

    // Store the highest, second-highest, third-highest, and fourth-highest color
    if (results.length > 0) {
      let first = results[0].name;
      setHighestColorName(JSON.stringify(first, null, 2));
      setSecondHighestColorName(results[1].name);
      setThirdHighestColorName(results[2].name);
      setFourthHighestColorName(results[3].name);
    }

    setFinalResults(results);
  }, []);

  console.log("Final Results:", finalResults);
  console.log("higgg", highestColor);

  const letterToColor = {
    C: "blue",
    B: "yellow",
    D: "green",
    A: "red",
  };

  // Count the occurrences of each letter
  const colorCounts = last20Weights.reduce((acc, letter) => {
    const color = letterToColor[letter]; // Get the corresponding color
    if (color) {
      acc[color] = (acc[color] || 0) + 1; // Increment the count for this color
    }
    return acc;
  }, {});

  console.log("Color Counts:", colorCounts);

  const FourStrengthsTable = () => {
    const tableData = [
      { position: "Buyer", red: 8, yellow: 7, blue: 2, green: 3 },
      { position: "Sales", red: 7, yellow: 8, blue: 5, green: 0 },
      { position: "Research Specialist", red: 5, yellow: 5, blue: 5, green: 5 },
      {
        position: "Dig Lead Coordinator",
        red: 5,
        yellow: 6,
        blue: 4,
        green: 5,
      },
      { position: "Dig Lead Locator", red: 5, yellow: 3, blue: 6, green: 6 },
      { position: "Locator Buyer", red: 5, yellow: 7, blue: 3, green: 5 },
      {
        position: "Coordinator (New Office)",
        red: 5,
        yellow: 6,
        blue: 4,
        green: 5,
      },
      {
        position: "Appointment Specialist",
        red: 5,
        yellow: 7,
        blue: 3,
        green: 5,
      },
      { position: "Closing Coordinator", red: 5, yellow: 5, blue: 5, green: 5 },
      { position: "Office Manager", red: 5, yellow: 5, blue: 5, green: 5 },
      { position: "Sales Manager", red: 7, yellow: 7, blue: 5, green: 1 },
      {
        position: "Construction Manager",
        red: 6,
        yellow: 7,
        blue: 2,
        green: 5,
      },
      { position: "Investor Relations", red: 6, yellow: 7, blue: 5, green: 2 },
    ];

    return (
      <div className="fourTable" style={{ padding: "20px" }}>
        <h2>Adult Strengths Profile for Organizational Positions</h2>
        <table
          border="1"
          style={{ borderCollapse: "collapse" }}
          className="tablePro"
        >
          <thead>
            <tr>
              <th>Position</th>
              <th>Red (Action)</th>
              <th>Yellow (Talking)</th>
              <th>Blue (Thinking)</th>
              <th>Green (Checking)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index}>
                <td>{row.position}</td>
                <td>{row.red}</td>
                <td>{row.yellow}</td>
                <td>{row.blue}</td>
                <td>{row.green}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="App">
      {!showResults ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "start",
            minWidth: "700px",
          }}
        >
          {/* Render Progress Bar */}
          <div className="progress-container">
            <div
              className="progress-bar"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
          <p>{getCurrentStep()}</p>
          <p>{profiling()}</p>
          {/* <h3 style={{ marginTop: "0px" }}>
            {
              questionsUpdate[currentSection].questions[currentQuestion]
                .question
            }
          </h3> */}
          {questionsUpdate[currentSection].questions[
            currentQuestion
          ].options.map((option) => (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                flexDirection: "row-reverse",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <p className="options" style={{ fontSize: "18px" }}>
                {option.text}
              </p>
              <button
                key={option.text}
                onClick={() =>
                  handleAnswerSelection(
                    questionsUpdate[currentSection].questions[currentQuestion]
                      .id,
                    option.text
                  )
                }
                className="opts"
                style={{
                  backgroundColor:
                    answers[
                      questionsUpdate[currentSection].questions[currentQuestion]
                        .id
                    ] === option.text
                      ? `#6357A4`
                      : "white",
                  color:
                    answers[
                      questionsUpdate[currentSection].questions[currentQuestion]
                        .id
                    ] === option.text
                      ? `white`
                      : "",
                  margin: "5px",
                  padding: "25px",
                  border: "0.5px solid black",
                  borderRadius: "15px",
                  marginTop: "10px",
                  fontFamily: "Poppins",
                  fontSize: "20px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              ></button>
            </div>
          ))}
          <br />
          {allQuestionsAnswered && currentQuestion === 19 && (
            <div className="details">
              <h3>Enter Your Details:</h3>
              <input
                type="text"
                name="name"
                placeholder="Name"
                value={userDetails.name}
                onChange={handleInputChange}
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={userDetails.email}
                onChange={handleInputChange}
              />
              <input
                type="tel"
                name="phone"
                placeholder="Phone"
                value={userDetails.phone}
                onChange={handleInputChange}
              />
            </div>
          )}

          <div className="controllBtn">
            {(currentQuestion > 0 || currentSection > 0) && (
              <button className="prev" onClick={handlePreviousQuestion}>
                Previous
              </button>
            )}

            {allQuestionsAnswered && (
              <button className="sub" onClick={handleSubmit}>
                Submit
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="riz">
          <h2 className="resultHeader">
            {userDetails.name}'s Strengths-Matrix Results
          </h2>
          <div className="innerResults">
            <div className="chart charDiv">
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "10px", // Space between buttons
                  marginBottom: "20px",
                }}
              >
                <button
                  onClick={handleRetake}
                  // className="retake"
                  id="download-button2"
                  style={{
                    padding: "10px 15px",
                    backgroundColor: "#FECACA",
                    cursor: "pointer",
                    border: "none",
                    height: "50px",
                    borderRadius: "50px",
                    fontSize: "14px",
                  }}
                >
                  Retake Test
                </button>
                {/* <button onClick={generatePDF} className="pdf">Download Result</button> */}
                {/* Hide button while generating PDF */}
                {!isGenerating && (
                  <button
                    id="download-button"
                    // className="pdf"
                    // onClick={generatePDF}
                    onClick={() => newpdf(userDetails, feedback, identity, feedback2, identity2, feedback3, identity3, feedback4, identity4, sortedCombined, childWithColorsPdf, parentWithColorsPdf, adultWithColorsPdf)}
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
                    }}
                  >
                    Download PDF
                  </button>
                )}

                {isGenerating && <p>Generating PDF, please wait...</p>}
              </div>
              <Doughnut data={data} className="dou" ref={chartRef} />
            </div>
            <div style={{ marginBottom: "80px" }} className="feedback">
              <ColorFeedback3 />
              <ColorFeedback4 />
              <ColorFeedback2 />
              {/* <FourStrengthsTable /> */}
            </div>
            <div style={{ marginBottom: "80px" }} className="feedback">
              <ColorFeedback />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
