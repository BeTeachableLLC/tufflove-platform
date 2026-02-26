/* eslint-disable no-unused-vars */
import { jsPDF } from "jspdf";
import logo from "./logo-white.png";

const newpdf = (
    userDetails,
    feedback, identity,
    feedback2, identity2,
    feedback3, identity3,
    feedback4, identity4,
    sortedCombined,
    childWithColorsPdf,
    parentWithColorsPdf,
    adultWithColorsPdf
) => {
    const doc = new jsPDF();
    let pageNumber = 1;
    let currentY = 40; // Starting Y position after logo

    const drawPageBorder = () => {
        doc.setDrawColor(256, 256, 256);
        doc.setLineWidth(1.5);
        doc.roundedRect(5, 5, 200, 287, 10, 10, "S");
    };

    const addSoftBackground = (color = [22, 0, 57]) => {
        doc.setFillColor(...color);
        doc.rect(0, 0, 210, 297, "F");
    };

    const addFooter = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text("www.beteachable.com", 105, 285, { align: "center" });
        doc.text(`Page ${pageNumber}`, 105, 290, { align: "center" });
    };

    const namedColors = {
        red: [255, 0, 0],
        blue: [0, 0, 255],
        yellow: [255, 255, 0],
        green: [0, 128, 0],
        orange: [255, 165, 0],
        purple: [128, 0, 128],
        // Add more named colors if needed
    };

    const hexToRgbInd = (hex) => {
        if (namedColors[hex]) return namedColors[hex]; // Handle named colors

        if (hex.startsWith("#")) {
            hex = hex.replace(/^#/, "");
            if (hex.length === 3) {
                hex = hex.split("").map((char) => char + char).join("");
            }
            const bigint = parseInt(hex, 16);
            return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
        }
        return [255, 255, 255]; // Default to white if unknown
    };


    const hexToRgb = (hex) => {
        if (!hex || typeof hex !== "string") return [0, 0, 0];
        hex = hex.replace(/^#/, "");
        if (hex.length === 3) hex = hex.split("").map((h) => h + h).join("");
        const bigint = parseInt(hex, 16);
        return isNaN(bigint) ? [0, 0, 0] : [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    const addIndividualProfilesSection = () => {
        const sections = [
            { title: "How You React Under Stress", data: childWithColorsPdf },
            { title: "What You Feel You Ought to Do/How You Should Think", data: parentWithColorsPdf },
            { title: "What You Prefer To Do/How You Are Effective", data: adultWithColorsPdf },
        ];

        sections.forEach(({ title, data }) => {
            if (!data || !Array.isArray(data) || !data.length) return;

            // Sort data by `value` in descending order
            data.sort((a, b) => b.value - a.value);

            // Section Title
            doc.setFont("helvetica", "normal");
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text(title, 15, currentY);
            currentY += 10;

            // Table Headers
            doc.setFontSize(10);
            doc.text("Color", 15, currentY);
            doc.text("", 35, currentY);
            doc.text("Score", 45, currentY);
            doc.text("Profile", 65, currentY);
            currentY += 5;

            data.forEach(({ color, profile, value }) => {
                if (currentY > 260) {
                    return; // Prevent overflow
                }

                const rgbColor = hexToRgbInd(color);
                const capitalizedColor = capitalize(color);

                // Color name
                doc.setFontSize(10);
                doc.setTextColor(255, 255, 255);
                doc.text(`${capitalizedColor || "N/A"}`, 15, currentY);

                // Color square
                doc.setFillColor(...rgbColor);
                doc.rect(35, currentY - 3, 4, 4, "F");

                // Score
                doc.text(`${value || "N/A"}`, 45, currentY);

                // Profile
                doc.text(`${profile || "N/A"}`, 65, currentY);

                currentY += 7;
            });

            currentY += 10; // Extra space after section
        });
    };



    const addTotalResultSection = () => {
        if (!sortedCombined || !Array.isArray(sortedCombined) || !sortedCombined.length) return;

        // Section Title
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text("Total Result", 15, currentY);
        currentY += 10;

        // Table Headers
        doc.setFontSize(10);
        doc.text("Color", 15, currentY);
        doc.text("", 35, currentY);
        doc.text("Score", 45, currentY);
        doc.text("Profile", 65, currentY);
        currentY += 5;

        sortedCombined.forEach(({ code, name, value, result }) => {
            if (currentY > 260) {
                // If we run out of space on first page, we'll truncate rather than add new page
                return;
            }

            const rgbColor = hexToRgb(code);
            // Color name
            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(`${name || "N/A"}`, 15, currentY);

            // Color square
            doc.setFillColor(...rgbColor);
            doc.rect(35, currentY - 3, 4, 4, "F");

            // Score
            doc.text(`${result || "N/A"}`, 45, currentY);

            // Profile
            doc.text(`${value || "N/A"}`, 65, currentY);

            currentY += 7;
        });

        currentY += 5; // Space after section
    };

    const addFeedbackSection = (feedbackDataArray) => {
        if (!feedbackDataArray || !Array.isArray(feedbackDataArray) || !feedbackDataArray.length) return;

        feedbackDataArray.forEach(({ feedback, identity }, index) => {
            if (!feedback || !identity) return;

            doc.addPage();
            pageNumber += 1;

            addSoftBackground();
            drawPageBorder();
            addFooter();

            let currentY = 30;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            doc.setFillColor(255, 255, 255); // White background
            doc.roundedRect(10, currentY, 190, 20, 10, 10, "FD");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0); // Black text
            doc.text(`Personality Feedback ${index + 1}`, 15, currentY + 12);


            currentY += 35;

            // Add Identity
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            // doc.text(`Identity: ${identity}`, 15, currentY);
            currentY += 2;

            // Helper function to add text with wrapping and pagination
            const addTextBlock = (text, isHeading = false) => {
                const fontSize = isHeading ? 14 : 12;
                const lineHeight = isHeading ? 8 : 6;
                doc.setFont("helvetica", isHeading ? "bold" : "normal");
                doc.setFontSize(fontSize);
                const lines = doc.splitTextToSize(text, 180);
                lines.forEach((line) => {
                    if (currentY > 260) {
                        addFooter();
                        doc.addPage();
                        addSoftBackground();
                        drawPageBorder();
                        pageNumber += 1;
                        currentY = 30;
                    }
                    doc.text(line, 15, currentY);
                    currentY += lineHeight;
                });
                currentY += 4;
            };

            let title, description, commPrefs, strengthsWeaknesses, needsMotivations, summary;

            if (identity.includes("Decision Makers")) {
                title = "Result-Oriented and Driven";
                description = "You are a highly driven and goal-oriented individual who is focused on achieving tangible results. You have a direct communication style and are confident in your abilities, often taking a competitive approach to tasks and projects.";
                commPrefs = "Direct Communication Style: When communicating with you, it is best to be concise and to the point. You prefer clear and straightforward information, as you believe that people should already know what they are doing. You are a 'bottom-line' person who values efficiency and getting things done.";
                strengthsWeaknesses = "Your key strengths lie in your ability to make decisions, achieve your goals, and take calculated risks. However, you may sometimes overlook the importance of caution and long-term considerations, focusing instead on short-term results. Additionally, you have a very high built-in sense of urgency.";
                needsMotivations = "To thrive, you require a sense of power, authority, and the ability to win. You are motivated by quantifiable achievements and the opportunity to demonstrate your competence and drive.";
                summary = "Overall, you are a highly capable and results-oriented individual who values direct communication, decision-making, and the achievement of your goals.";
            } else if (identity.includes("Communicators")) {
                title = "Friendly, Outgoing, and Emotional";
                description = "You are a vibrant and sociable individual who thrives on human connection and spontaneity. Your orientation is people-focused, with results taking a secondary priority. You are enthusiastic, expressive, and enjoy engaging in lively conversations.";
                commPrefs = "When communicating with you, it is best to ask for your help and input. You appreciate being involved and valued for your unique perspective. Showcase your enthusiasm and excitement, and look for common ground that can foster a sense of camaraderie.";
                strengthsWeaknesses = "Your key strengths include your strong communication skills, adaptability, and optimistic outlook. However, you may sometimes struggle with a lack of time management, difficulty following up on tasks, and a tendency to be overly subjective.";
                needsMotivations = "To feel fulfilled, you require recognition, acceptance, and the opportunity to exert influence and be involved. You are motivated by flexibility, options, and the chance to participate actively.";
                summary = "Overall, you are a vibrant and people-oriented individual who thrives on social interaction, enthusiasm, and a sense of belonging.";
            } else if (identity.includes("Patient")) {
                title = "Sincere and Focused on Problem-Solving";
                description = "You are a sincere and thoughtful individual who takes great pride in being a good listener and a problem-solver. Your focus is on making things better and maintaining harmony, often taking on the role of peacekeeper.";
                commPrefs = "When communicating with you, it is important to ask for your input and opinions. You thrive when given the freedom to evaluate alternatives and choose the best course of action. Showing appreciation for your ideas is key.";
                strengthsWeaknesses = "Your key strengths include your ability to listen attentively, your patience, and your skill in evaluating alternatives. However, you may sometimes struggle with conflict avoidance and procrastination.";
                needsMotivations = "To feel fulfilled, you require a sense of appreciation, the freedom to explore options, and the time needed to thoroughly consider and implement solutions.";
                summary = "Overall, you are a supportive and problem-solving oriented individual who values collaboration and continuous improvement.";
            } else if (identity.includes("Accurate")) {
                title = "Analytical and Cautious";
                description = "You are an analytical individual who values consistency, caution, and high standards. You carefully consider your decisions and actions, preferring to 'look before you leap' to avoid repeating past mistakes.";
                commPrefs = "When communicating with you, it is important to provide a clear and structured approach, addressing the 'how' rather than just the 'what.' You thrive on predictability and control, so presenting detailed information early on builds trust.";
                strengthsWeaknesses = "Your key strengths lie in your analytical abilities, accuracy, and commitment to maintaining high standards. However, this can also lead to rigidity, procrastination, and an overly critical perspective.";
                needsMotivations = "To feel fulfilled, you require a sense of control, the opportunity to engage in precise and detailed work, and a consistent environment.";
                summary = "Overall, you are a thoughtful and cautious individual who values structure, predictability, and a methodical approach.";
            }

            addTextBlock(title, true);
            addTextBlock(description);
            addTextBlock("Communication Preferences", true);
            addTextBlock(commPrefs);
            addTextBlock("Strengths and Weaknesses", true);
            addTextBlock(strengthsWeaknesses);
            addTextBlock("Needs and Motivations", true);
            addTextBlock(needsMotivations);
            addTextBlock(summary);

            addFooter();
        });
    };

    // First Page Setup
    addSoftBackground();
    drawPageBorder();

    // Add logo first
    doc.addImage(logo, "PNG", 75, 10, 60, 20);

    // SWOT Analysis title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(25);
    doc.setTextColor(236, 66, 244);
    doc.text(userDetails.name + " " + "Strengths-Matrix Result", 105, currentY, { align: "center" });
    currentY += 15;

    // Add individual profiles and total results on first page
    addIndividualProfilesSection();
    addTotalResultSection();

    // Add Feedback Sections on subsequent pages
    const feedbackData = [
        { feedback, identity },
        { feedback: feedback2, identity: identity2 },
        { feedback: feedback3, identity: identity3 },
        { feedback: feedback4, identity: identity4 },
    ].filter(item => item.feedback && item.identity);

    addFeedbackSection(feedbackData);

    addFooter();
    doc.save(userDetails.name + " " + "Strengths-Matrix Result.pdf");
};

export default newpdf;