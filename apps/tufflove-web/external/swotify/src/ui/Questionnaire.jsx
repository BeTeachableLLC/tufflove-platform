import React, { useState } from "react";
import ProgressBar from "./ProgressBar";
import Question from "./Question";
import Results from "./Results";


const questionsData = [
  {
    id: 1,
    question: "Does your business have a formalized accountability chart?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! A formalized accountability chart ensures clarity in roles and responsibilities, which is essential for operational efficiency. Regularly review and update it to align with evolving business goals.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "Consider creating an accountability chart to define roles and responsibilities clearly. This will streamline decision-making and improve accountability across your organization.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your organizational structure and develop a formal accountability chart to clarify roles and responsibilities.",
      },
    ],
  },
  {
    id: 2,
    question:
      "Do you hold regularly scheduled leadership calibration meetings?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Regular leadership meetings foster alignment and ensure your team is working towards common goals. Use these meetings to address challenges, share updates, and strategize for growth.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Scheduling regular leadership meetings can help align goals, address issues, and maintain a cohesive leadership team. Start by setting a recurring schedule and clear agendas.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for clarity. Evaluate the benefits of regular leadership meetings and consider implementing a schedule to improve team alignment and communication.",
      },
    ],
  },
  {
    id: 3,
    question: "Do you have positive cash flow?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Well done! Positive cash flow is a critical indicator of financial health. Leverage this strength to reinvest in growth opportunities, build financial resilience, and prepare for future challenges.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "Negative cash flow can be a significant weakness. Analyze your cash flow to identify areas of concern and develop strategies to improve liquidity, such as cost-cutting, increasing revenue, or renegotiating payment terms.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty in cash flow can be risky. Conduct a thorough financial review to gain clarity and take steps to ensure positive cash flow. Consider consulting a financial advisor for guidance.",
      },
    ],
  },
  {
    id: 4,
    question:
      "Do you have a clear understanding of your target market, including their location and how to effectively reach them?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! A clear understanding of your target market is a significant strength. Use this knowledge to refine your marketing strategies, enhance customer engagement, and tailor your offerings to meet their needs.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Invest in market research to better understand your target audience and develop strategies to reach them effectively. Tools like surveys, focus groups, and analytics can help.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here indicates a need for more research. Consider conducting surveys or analyzing customer data to gain insights into your target market and refine your approach.",
      },
    ],
  },
  {
    id: 5,
    question: "Do you have a clear and identifiable logo/brand?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! A strong brand identity is crucial for market recognition. Leverage your brand to build customer loyalty, differentiate yourself from competitors, and create a lasting impression.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Work with a branding expert to develop a clear and identifiable logo that resonates with your target audience and reflects your business values.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for brand evaluation. Assess your current branding and consider redesigning your logo to ensure it aligns with your business identity and goals.",
      },
    ],
  },
  {
    id: 6,
    question: "Do you have established standard operating procedures?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Standard operating procedures (SOPs) ensure consistency and efficiency in operations. Use them to train staff, maintain high-quality standards, and scale your business effectively.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Develop SOPs to streamline processes, reduce errors, and improve operational efficiency. Start by documenting key processes and involving your team in the creation process.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here indicates a need for process evaluation. Consider documenting your key processes to create SOPs that enhance consistency and efficiency.",
      },
    ],
  },
  {
    id: 7,
    question: "Do you have multiple product lines?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Multiple product lines diversify your revenue streams and reduce risk. Focus on optimizing and cross-promoting these products to maximize profitability and customer satisfaction.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is a promising area for growth. Explore opportunities to expand your product offerings to meet customer needs and increase market share. Start by identifying gaps in the market or customer demands.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for growth. Evaluate your market and consider developing additional product lines to diversify your offerings and attract new customers.",
      },
    ],
  },
  {
    id: 8,
    question: "Do you have a fully developed onboarding/training program?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Well done! A strong onboarding program enhances employee satisfaction and productivity. Use this to build a skilled and motivated workforce and ensure consistent performance across your team.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Develop a comprehensive onboarding program to ensure new hires are well-integrated and equipped for success. Include training materials, mentorship, and clear expectations.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for program evaluation. Assess your current onboarding process and identify areas for improvement to enhance employee integration and performance.",
      },
    ],
  },
  {
    id: 9,
    question: "Do you have a strong retention rate for staff?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! High staff retention indicates a positive work environment and strong leadership. Leverage this to attract top talent, maintain organizational stability, and foster a culture of loyalty.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Analyze the reasons for staff turnover and implement strategies to improve employee satisfaction and retention, such as better benefits, career development opportunities, and a positive work culture.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for analysis. Conduct employee surveys to understand retention challenges and address them effectively to build a more stable workforce.",
      },
    ],
  },
  {
    id: 10,
    question: "Do you have a built-out and optimized CRM?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great job! An optimized CRM enhances customer relationship management and drives sales. Use this tool to personalize customer interactions, improve service, and analyze customer data for strategic decisions.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Invest in a CRM system to streamline customer management, improve sales efficiency, and enhance customer satisfaction. Research options that fit your business needs.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for system evaluation. Research CRM options and consider implementing one to enhance customer management and drive growth.",
      },
    ],
  },
  {
    id: 11,
    question:
      "Do you have a documented strategic growth plan with measurable milestones for the short, mid, and long term?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! A documented growth plan with measurable milestones is a key strength that provides direction and accountability. Regularly review and adjust your plan to ensure it aligns with changing market conditions and business goals.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A strategic growth plan is essential for setting clear objectives and tracking progress. Consider developing a plan that outlines your vision, goals, and actionable steps.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess whether your business has a growth plan and, if not, prioritize creating one to guide your strategic decisions.",
      },
    ],
  },
  {
    id: 12,
    question: "Are you horizontally and/or vertically integrated?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Horizontal or vertical integration is a key strength that can enhance efficiency, reduce costs, and improve control over your supply chain. Leverage this to gain a competitive edge and explore further opportunities for integration.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is a promising area for growth. Consider exploring horizontal or vertical integration to improve efficiency, reduce costs, or expand your market reach. Start by identifying areas where integration could add value.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for growth. Evaluate whether horizontal or vertical integration could benefit your business and explore opportunities to implement it strategically.",
      },
    ],
  },
  {
    id: 13,
    question:
      "Do you know what your monthly/quarterly/annual breakeven point is?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Knowing your breakeven point is a critical strength for financial planning and decision-making. Use this knowledge to set realistic goals, manage costs, and evaluate profitability.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Calculating your breakeven point is essential for understanding when your business becomes profitable. Work with your finance team or use tools to determine this metric.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for financial clarity. Prioritize calculating your breakeven point to gain insights into your business's financial health and make informed decisions.",
      },
    ],
  },
  {
    id: 14,
    question: "Do you have a clear, detailed budget?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! A clear, detailed budget is a key strength that helps you allocate resources effectively and track financial performance. Regularly review and adjust your budget to reflect changing circumstances.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A detailed budget is essential for financial control and planning. Develop a budget that outlines income, expenses, and savings to guide your business decisions.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for financial organization. Work on creating a detailed budget to improve financial transparency and ensure better resource allocation.",
      },
    ],
  },
  {
    id: 15,
    question: "Do you have months/quarters where you operate at a loss?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Operating at a loss can be a challenge. Analyze the reasons behind these losses and develop strategies to minimize them, such as cost-cutting, increasing revenue, or improving efficiency.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! Consistently avoiding losses is a significant strength. Leverage this stability to reinvest in growth opportunities and build financial resilience.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for financial analysis. Review your financial statements to identify any periods of loss and address the underlying causes.",
      },
    ],
  },
  {
    id: 16,
    question: "Do you have clearly defined and empowered leadership positions?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Clearly defined and empowered leadership positions are essential for effective decision-making and team alignment. Continue to support and develop your leaders to drive success.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Clearly defining leadership roles and empowering leaders can improve accountability and decision-making. Consider creating role descriptions and providing leadership training.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for organizational clarity. Evaluate your leadership structure and work on defining and empowering key roles to enhance team performance.",
      },
    ],
  },
  {
    id: 17,
    question:
      "Do you have measurable online engagement metrics (e.g. website traffic, social media reach, SEO rankings)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Tracking online engagement metrics is a key strength that helps you measure the effectiveness of your digital presence. Use these insights to refine your strategies and improve results.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Measuring online engagement is essential for understanding your audience and optimizing your digital marketing efforts. Consider using tools like Google Analytics or social media insights.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for digital strategy evaluation. Start tracking key metrics to gain insights into your online performance and identify areas for improvement.",
      },
    ],
  },
  {
    id: 18,
    question:
      "Is your current marketing plan tailored to your target market and supported by a strong digital presence?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! A tailored marketing plan with a strong digital presence is a significant strength. Leverage this to engage your audience, build brand awareness, and drive sales.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Tailoring your marketing plan to your target market and strengthening your digital presence can significantly improve your reach and effectiveness. Consider conducting market research and enhancing your online strategies.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for marketing evaluation. Review your current plan and ensure it aligns with your target market's needs and preferences.",
      },
    ],
  },
  {
    id: 19,
    question: "Do you have an active advertising campaign?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! An active advertising campaign is a key strength that helps you reach new customers and maintain brand visibility. Continuously monitor and optimize your campaigns for better results.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. An active advertising campaign can drive customer acquisition and brand awareness. Consider developing a campaign that aligns with your business goals and target audience.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for marketing action. Evaluate the potential benefits of advertising and consider launching a campaign to boost your visibility and sales.",
      },
    ],
  },
  {
    id: 20,
    question:
      "Do you have clearly defined monthly/quarterly/annual S.M.A.R.T. goals?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Clearly defined S.M.A.R.T. goals provide direction and accountability. Use these goals to track progress, motivate your team, and achieve your business objectives.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Setting S.M.A.R.T. goals is essential for measuring success and staying focused. Work on defining specific, measurable, achievable, relevant, and time-bound goals.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for goal-setting clarity. Develop S.M.A.R.T. goals to provide a clear roadmap for your business and track your progress effectively.",
      },
    ],
  },
  {
    id: 21,
    question:
      "Do you have a website that fits your business and customer needs?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! A well-designed website that meets your business and customer needs is a significant strength. Use it to enhance customer experience, showcase your offerings, and drive conversions.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A website is essential for establishing an online presence and serving your customers effectively. Consider investing in a professional website that aligns with your brand and goals.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for digital evaluation. Assess your current website and ensure it meets your business and customer needs.",
      },
    ],
  },
  {
    id: 22,
    question: "Do you utilize software to help streamline work processes?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Utilizing software to streamline work processes is a key strength that improves efficiency and productivity. Regularly review your tools to ensure they meet your evolving needs.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Streamlining work processes with software can save time and reduce errors. Research tools that fit your business needs and implement them to enhance efficiency.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for process evaluation. Explore software solutions that can help streamline your operations and improve productivity.",
      },
    ],
  },
  {
    id: 23,
    question:
      "Do you have an effective tool(s) for internal communication and collaboration?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Effective communication and collaboration tools are essential for team alignment and productivity. Use these tools to foster collaboration and streamline workflows.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Implementing tools for internal communication and collaboration can enhance teamwork and efficiency. Consider platforms like Slack, Microsoft Teams, or Asana.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your current communication methods and explore tools that can improve collaboration and team performance.",
      },
    ],
  },
  {
    id: 24,
    question:
      "Do you have an effective tool(s) for external communication and collaboration?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Effective tools for external communication and collaboration help you build strong relationships with clients and partners. Use these tools to enhance customer service and streamline interactions.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. External communication tools are essential for maintaining strong client and partner relationships. Consider platforms like Zoom, HubSpot, or email marketing tools.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Explore tools that can improve your external communication and collaboration to strengthen relationships and drive success.",
      },
    ],
  },
  {
    id: 25,
    question: "Are you able to manage strategic change?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! The ability to manage strategic change is a critical strength that ensures your business remains agile and competitive. Continue to foster a culture of adaptability and innovation to navigate future challenges.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Managing strategic change is essential for long-term success. Consider investing in change management training and developing a clear framework for implementing and communicating changes.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your current processes for managing change and identify areas for improvement to enhance your adaptability.",
      },
    ],
  },
  {
    id: 26,
    question: "Is your business recession/pandemic proof?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Being recession/pandemic proof is a significant strength that demonstrates resilience. Leverage this stability to explore growth opportunities and build long-term sustainability.",
      },
      {
        label: "No",
        quadrant: "Threat",
        response:
          "This is a critical area to address. Consider diversifying revenue streams, building financial reserves, and developing contingency plans to mitigate the impact of economic downturns or global crises.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for risk assessment. Evaluate your business's vulnerabilities and take steps to strengthen your resilience against economic or global disruptions.",
      },
    ],
  },
  {
    id: 27,
    question: "Have you expanded into untapped/emerging markets?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Expanding into untapped or emerging markets is a key strength that can drive growth and increase market share. Continue to explore new opportunities and adapt your strategies to meet local demands.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is a promising area for growth. Research untapped or emerging markets that align with your business goals and develop a strategy to enter these markets effectively.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for growth. Conduct market research to identify opportunities in untapped or emerging markets and consider expanding your reach.",
      },
    ],
  },
  {
    id: 28,
    question: "Do you have an active R&D team/process?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! An active R&D team/process is a significant strength that drives innovation and keeps your business competitive. Continue to invest in R&D to develop new products, improve existing ones, and stay ahead of industry trends.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Establishing an R&D team or process can help you innovate and meet evolving customer needs. Start by allocating resources and setting clear objectives for R&D initiatives.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Evaluate the benefits of R&D and consider implementing a process to foster innovation and growth.",
      },
    ],
  },
  {
    id: 29,
    question: "Have you expanded your core business?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Expanding your core business is a key strength that demonstrates growth and adaptability. Continue to explore opportunities to enhance your offerings and meet customer demands.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is a promising area for growth. Consider ways to expand your core business, such as introducing new products, entering new markets, or enhancing your services.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for growth. Assess your core business and identify opportunities for expansion to increase revenue and market share.",
      },
    ],
  },
  {
    id: 30,
    question:
      "Have you adopted new technologies, including AI and automation, to optimize processes and improve efficiency?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Adopting new technologies like AI and automation is a significant strength that enhances efficiency and competitiveness. Continue to explore emerging technologies to further optimize your operations.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Implementing technologies like AI and automation can streamline processes, reduce costs, and improve productivity. Research tools that align with your business needs and start integrating them.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Evaluate how new technologies can benefit your business and consider adopting them to stay competitive.",
      },
    ],
  },
  {
    id: 31,
    question: "Do you collect data to identify unfilled customer needs?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Collecting data to identify unfilled customer needs is a key strength that helps you stay customer-focused and innovative. Use this data to refine your offerings and address gaps in the market.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Collecting customer data can provide valuable insights into unmet needs and preferences. Consider implementing surveys, focus groups, or analytics tools to gather this information.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Start collecting and analyzing customer data to better understand their needs and tailor your offerings accordingly.",
      },
    ],
  },
  {
    id: 32,
    question: "Do you have a diversified asset portfolio?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! A diversified asset portfolio is a significant strength that reduces risk and enhances financial stability. Continue to manage and optimize your portfolio to maximize returns.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Diversifying your asset portfolio can help mitigate risks and improve financial resilience. Consider exploring new investment opportunities that align with your business goals.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Evaluate your current assets and explore ways to diversify your portfolio to reduce risk and increase stability.",
      },
    ],
  },
  {
    id: 33,
    question:
      "Have you explored ways to extend/create cost advantage (e.g. economies of scale, process automation, outsourcing)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Creating a cost advantage is a key strength that enhances competitiveness. Continue to explore opportunities to reduce costs and improve efficiency without compromising quality.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Consider strategies like economies of scale, process automation, or outsourcing to reduce costs and gain a competitive edge.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Evaluate your current cost structure and identify opportunities to create a cost advantage.",
      },
    ],
  },
  {
    id: 34,
    question:
      "Do you actively employ strategies to increase product innovation?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Actively pursuing product innovation is a significant strength that keeps your business competitive and customer-focused. Continue to invest in innovation to meet evolving market demands.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Developing strategies to increase product innovation can help you stay ahead of competitors and meet customer needs. Consider allocating resources to R&D and fostering a culture of creativity.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Assess your current approach to innovation and explore ways to enhance it to drive growth.",
      },
    ],
  },
  {
    id: 35,
    question: "Has there been a recent increase in market competition?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Increased competition can be challenging. Analyze your competitors' strategies and focus on differentiating your offerings to maintain your market position. Consider enhancing customer experience and investing in innovation.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Great! A stable competitive environment is a strength that allows you to focus on growth and innovation. Use this opportunity to strengthen your market position and prepare for potential future competition.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for market analysis. Monitor your industry for competitive trends and develop strategies to address potential threats.",
      },
    ],
  },
  {
    id: 36,
    question: "Has there been a recent emergence of new, substitute products?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "The emergence of substitute products can impact your market share. Focus on differentiating your offerings and highlighting your unique value proposition to retain customers.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! A lack of substitute products is a strength that provides stability. Use this advantage to strengthen your market position and build customer loyalty.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for market research. Monitor your industry for substitute products and develop strategies to address potential threats.",
      },
    ],
  },
  {
    id: 37,
    question:
      "Have you been/could you be impacted by new or increased regulations?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "New or increased regulations can pose challenges. Stay informed about regulatory changes and ensure compliance by working with legal and compliance experts. Proactively adapt your processes to meet new requirements.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Great! A stable regulatory environment is a strength that allows you to focus on growth and operations. Continue monitoring for potential changes to stay ahead.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for risk assessment. Evaluate your industry’s regulatory landscape and prepare for potential changes to ensure compliance.",
      },
    ],
  },
  {
    id: 38,
    question: "Does your industry have a low barrier to entry?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Low barriers to entry can increase competition. Focus on building strong brand loyalty, enhancing customer experience, and innovating to maintain a competitive edge.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! High barriers to entry are a strength that protects your market position. Leverage this advantage to solidify your presence and explore growth opportunities.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for industry analysis. Evaluate the barriers to entry in your market and develop strategies to address potential competition.",
      },
    ],
  },
  {
    id: 39,
    question:
      "Have you been/could you be impacted by new or increased trade barriers?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Trade barriers can disrupt operations and increase costs. Consider diversifying your supply chain, exploring alternative markets, and working with trade experts to mitigate risks.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Great! A lack of trade barriers is a strength that supports smooth operations and market access. Continue monitoring for potential changes to stay prepared.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for risk assessment. Evaluate your exposure to trade barriers and develop contingency plans to address potential disruptions.",
      },
    ],
  },
  {
    id: 40,
    question: "Have you been experiencing increased labor costs?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Rising labor costs can impact profitability. Explore strategies to improve efficiency, such as automation, process optimization, or outsourcing, while maintaining employee satisfaction.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! Stable labor costs are a strength that supports financial stability. Use this advantage to invest in employee development and operational improvements.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for financial analysis. Review your labor costs and identify trends to develop strategies for managing expenses effectively.",
      },
    ],
  },
  {
    id: 41,
    question: "Are you being outpaced by marketplace innovations?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Falling behind in innovation can be a significant threat. Invest in R&D, monitor industry trends, and foster a culture of creativity to stay competitive.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Great work! Staying ahead of marketplace innovations is a key strength. Continue to invest in innovation and adapt to emerging trends to maintain your competitive edge.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for market analysis. Evaluate your position relative to competitors and identify areas for innovation to stay relevant.",
      },
    ],
  },
  {
    id: 42,
    question: "Has there been a decrease in potential market share?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "A decrease in market share can be concerning. Analyze the reasons behind this trend and develop strategies to regain your position, such as improving customer experience, enhancing marketing efforts, or diversifying offerings.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! Maintaining or increasing market share is a strength that demonstrates strong performance. Leverage this to explore new opportunities and solidify your position.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for market analysis. Monitor your market share and identify factors that could impact it to develop proactive strategies.",
      },
    ],
  },
  {
    id: 43,
    question: "Are your competitors outpacing you in market growth?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Competitors outpacing you in growth can be a challenge. Analyze their strategies and identify areas where you can improve, such as product innovation, customer engagement, or marketing efforts.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Great work! Staying ahead of competitors in market growth is a key strength. Continue to focus on innovation and customer satisfaction to maintain your lead.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for competitive analysis. Evaluate your position relative to competitors and develop strategies to enhance your growth.",
      },
    ],
  },
  {
    id: 44,
    question: "Do you actively reinvest cash flow?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Reinvesting cash flow is a key opportunity to drive growth and innovation. Use this to expand your offerings, improve operations, and explore new markets.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Reinvesting cash flow can help you achieve long-term growth. Consider allocating resources to initiatives that align with your strategic goals.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for financial planning. Evaluate your cash flow and identify opportunities for reinvestment to support growth.",
      },
    ],
  },
  {
    id: 45,
    question: "Do you have a strong customer referral program?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! A strong customer referral program is a key strength that drives organic growth and builds trust. Continue to incentivize referrals and enhance customer satisfaction to maximize results.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A referral program can be a cost-effective way to acquire new customers. Consider developing a program that rewards loyal customers for referrals.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Explore the potential benefits of a referral program and consider implementing one to drive growth.",
      },
    ],
  },
  {
    id: 46,
    question:
      "Do you have a crisis management plan (e.g. protocols for handling HR crises, operational disruptions, cybersecurity breaches)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! A crisis management plan is a critical strength that ensures preparedness and resilience. Regularly review and update your plan to address emerging risks.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A crisis management plan is essential for mitigating risks and ensuring business continuity. Develop a plan that addresses potential crises and outlines clear protocols.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for risk assessment. Evaluate your preparedness for crises and consider developing a comprehensive management plan.",
      },
    ],
  },
  {
    id: 47,
    question: "Do you have a clear succession plan?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! A clear succession plan is a key strength that ensures leadership continuity and organizational stability. Regularly review and update your plan to reflect changes in your team or business goals.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A succession plan is essential for long-term success. Develop a plan that identifies potential leaders and outlines a clear path for transitions.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your leadership structure and consider developing a succession plan to ensure continuity.",
      },
    ],
  },
  {
    id: 48,
    question:
      "Do you have processes in place to regularly evaluate employee satisfaction (e.g. employee surveys, one-on-one feedback sessions, suggestion boxes)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Regularly evaluating employee satisfaction is a key strength that fosters a positive work environment and improves retention. Use this feedback to address concerns and enhance employee engagement.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Evaluating employee satisfaction is essential for building a motivated workforce. Consider implementing surveys or feedback sessions to gather insights.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Explore methods for assessing employee satisfaction and use the insights to improve your workplace culture.",
      },
    ],
  },
  {
    id: 49,
    question:
      "Do you offer flexible work arrangements (e.g. remote work, flexible hours)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Offering flexible work arrangements is a key strength that enhances employee satisfaction, productivity, and retention. Continue to evaluate and adapt these arrangements to meet both employee and business needs.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Flexible work arrangements can improve employee morale and attract top talent. Consider implementing options like remote work or flexible hours to enhance your workplace culture.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your current work policies and explore the potential benefits of offering flexible arrangements to support your team.",
      },
    ],
  },
  {
    id: 50,
    question:
      "Do you have a system in place to collect and act on customer feedback, including tracking metrics like Net Promoter Score to measure customer loyalty?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! A system for collecting and acting on customer feedback is a significant strength that helps you stay customer-focused and improve loyalty. Use this data to refine your offerings and address customer needs proactively.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Collecting and acting on customer feedback is essential for understanding customer satisfaction and loyalty. Consider implementing tools like surveys or Net Promoter Score tracking to gather insights.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Explore methods for collecting and analyzing customer feedback to better understand and meet customer expectations.",
      },
    ],
  },
  {
    id: 51,
    question:
      "Do you have a customer retention program in place that ensures a seamless experience across all channels?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! A customer retention program that ensures a seamless experience is a key strength that builds loyalty and drives repeat business. Continue to refine your program to adapt to changing customer needs.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A customer retention program can significantly enhance loyalty and lifetime value. Consider developing strategies like personalized communication, loyalty rewards, or omnichannel support.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your current customer experience and explore ways to implement a retention program that ensures consistency across all channels.",
      },
    ],
  },
  {
    id: 52,
    question:
      "Do you have robust cybersecurity measures in place (e.g. firewalls, encryption, multi-factor authentication, regular security audits)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Robust cybersecurity measures are a critical strength that protects your business and customer data. Regularly review and update your security protocols to stay ahead of emerging threats.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is a critical area to address. Insufficient cybersecurity can expose your business to significant risks. Invest in measures like firewalls, encryption, and regular audits to strengthen your defenses.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Conduct a cybersecurity assessment to identify vulnerabilities and implement measures to protect your business and data.",
      },
    ],
  },
  {
    id: 53,
    question:
      "Do you have a formal risk management framework (e.g. risk assessment matrices, mitigation strategies, compliance monitoring)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! A formal risk management framework is a key strength that ensures preparedness and resilience. Regularly review and update your framework to address emerging risks and maintain compliance.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A risk management framework is essential for identifying and mitigating potential threats. Consider developing tools like risk matrices and compliance monitoring to enhance your preparedness.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your current risk management practices and explore ways to formalize and strengthen your framework.",
      },
    ],
  },
  {
    id: 54,
    question: "Do you have a business continuity plan in place?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! A business continuity plan is a critical strength that ensures operational resilience during disruptions. Regularly test and update your plan to address new challenges and maintain readiness.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. A business continuity plan is essential for minimizing downtime and ensuring recovery during crises. Develop a plan that includes clear protocols and contingency measures.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your preparedness for disruptions and consider creating a comprehensive continuity plan to safeguard your operations.",
      },
    ],
  },
  {
    id: 55,
    question:
      "Is your supply chain designed to withstand disruptions (e.g. diversifying suppliers, maintaining safety stock, predictive analytics for demand forecasting)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! A resilient supply chain is a key strength that ensures operational stability. Continue to monitor and optimize your supply chain to address potential risks and improve efficiency.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is a critical area to address. A vulnerable supply chain can disrupt operations. Consider strategies like diversifying suppliers, maintaining safety stock, and using predictive analytics to enhance resilience.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your supply chain for vulnerabilities and explore ways to strengthen it against potential disruptions.",
      },
    ],
  },
  {
    id: 56,
    question:
      "Do you have comprehensive insurance coverage for potential risks?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Comprehensive insurance coverage is a key strength that protects your business from financial losses. Regularly review your policies to ensure they align with your evolving needs and risks.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is a critical area to address. Lack of insurance coverage can expose your business to significant risks. Work with an insurance advisor to identify and address coverage gaps.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Review your current insurance policies and assess whether they adequately cover potential risks to your business.",
      },
    ],
  },
  {
    id: 57,
    question:
      "Do you tailor your products or services to meet local market demands?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Tailoring your products or services to local market demands is a key strength that enhances customer satisfaction and competitiveness. Continue to adapt your offerings to meet evolving local needs.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is a promising area for growth. Customizing your products or services for local markets can improve customer engagement and market share. Conduct market research to identify specific local needs and preferences.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests potential for improvement. Evaluate your current offerings and explore ways to tailor them to better meet local market demands.",
      },
    ],
  },
  {
    id: 58,
    question: "Do you conduct regular research on global market trends?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Regular research on global market trends is a key strength that keeps you informed and competitive. Use these insights to anticipate changes and adapt your strategies effectively.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is a promising area for growth. Staying informed about global market trends can help you identify opportunities and mitigate risks. Consider dedicating resources to regular market research and analysis.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests potential for improvement. Explore ways to stay updated on global trends and use this information to guide your strategic planning.",
      },
    ],
  },
  {
    id: 59,
    question: "Do you use business intelligence tools to analyze performance?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Using business intelligence tools is a key strength that enables data-driven decision-making and performance optimization. Continue leveraging these tools to identify trends, improve efficiency, and gain a competitive edge.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Business intelligence tools can provide valuable insights into your operations and market trends. Consider implementing tools that align with your business needs to enhance decision-making.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Explore the benefits of business intelligence tools and consider adopting them to improve performance analysis and strategic planning.",
      },
    ],
  },
  {
    id: 60,
    question:
      "Do you use data analytics, including real-time insights, to inform and make business decisions?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Utilizing data analytics and real-time insights is a significant strength that enhances decision-making and responsiveness. Continue to refine your analytics processes to stay ahead of market trends.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Data analytics can provide actionable insights to inform your decisions and improve outcomes. Consider investing in tools and training to integrate analytics into your operations.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your current decision-making processes and explore how data analytics can enhance your strategic capabilities.",
      },
    ],
  },
  {
    id: 61,
    question:
      "Do you use predictive analytics to forecast trends and outcomes?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Predictive analytics is a powerful tool for anticipating trends and making proactive decisions. Use this capability to stay ahead of competitors and adapt to market changes effectively.",
      },
      {
        label: "No",
        quadrant: "Weakness",
        response:
          "This is an area for improvement. Predictive analytics can help you forecast trends and prepare for future challenges. Consider adopting tools and processes to integrate predictive insights into your strategy.",
      },
      {
        label: "Unsure",
        quadrant: "Weakness",
        response:
          "Uncertainty here suggests potential for improvement. Explore the benefits of predictive analytics and consider implementing them to enhance your forecasting and planning capabilities.",
      },
    ],
  },
  {
    id: 62,
    question:
      "Are geopolitical tensions or conflicts affecting your supply chain or market access (e.g. trade wars, sanctions, regional conflicts)?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Geopolitical tensions can disrupt operations and market access. Develop contingency plans, diversify your supply chain, and explore alternative markets to mitigate risks and maintain stability.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! A lack of geopolitical disruptions is a strength that supports smooth operations and market access. Continue monitoring global developments to stay prepared for potential changes.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for risk assessment. Evaluate your supply chain and market access for vulnerabilities and develop strategies to address potential geopolitical risks.",
      },
    ],
  },
  {
    id: 63,
    question:
      "Are your current cybersecurity measures sufficient to protect against emerging threats?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Robust cybersecurity measures are a critical strength that protects your business from emerging threats. Regularly review and update your security protocols to stay ahead of evolving risks.",
      },
      {
        label: "No",
        quadrant: "Threat",
        response:
          "This is a critical area to address. Insufficient cybersecurity can expose your business to significant risks. Invest in advanced security measures, employee training, and regular audits to strengthen your defenses.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for evaluation. Conduct a cybersecurity assessment to identify vulnerabilities and implement measures to protect against emerging threats.",
      },
    ],
  },
  {
    id: 64,
    question:
      "Are inflation, currency fluctuations, or recession risks impacting your financial stability?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Economic factors like inflation and currency fluctuations can pose significant challenges. Develop strategies to mitigate these risks, such as diversifying revenue streams, renegotiating contracts, and building financial reserves.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! Stability in the face of economic challenges is a strength that supports long-term growth. Continue monitoring economic trends and maintaining financial resilience.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for financial analysis. Evaluate your exposure to economic risks and develop contingency plans to safeguard your financial stability.",
      },
    ],
  },
  {
    id: 65,
    question:
      "Could advancements in technology (e.g. AI, blockchain) or new competitors (e.g. startups with innovative solutions) disrupt your business model?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Technological advancements and new competitors can disrupt your business model. Stay proactive by investing in innovation, monitoring industry trends, and adapting your strategies to remain competitive.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Great work! Stability in your business model despite technological advancements is a strength. Continue to innovate and monitor emerging trends to maintain your competitive edge.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your industry for potential disruptions and develop strategies to adapt and thrive in a changing landscape.",
      },
    ],
  },
  {
    id: 66,
    question:
      "Are you prepared to adapt to new regulations or compliance requirements in your industry?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Excellent! Being prepared for regulatory changes is a key strength that ensures compliance and operational continuity. Regularly review your processes and stay informed about industry developments.",
      },
      {
        label: "No",
        quadrant: "Threat",
        response:
          "This is a critical area to address. Non-compliance can lead to significant risks. Develop a framework for monitoring and adapting to new regulations to ensure your business remains compliant.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for evaluation. Assess your readiness for regulatory changes and implement measures to enhance your compliance capabilities.",
      },
    ],
  },
  {
    id: 67,
    question:
      "Could climate change or extreme weather events disrupt your operations or supply chain (e.g. flooding, hurricanes, droughts)?",
    options: [
      {
        label: "Yes",
        quadrant: "Threat",
        response:
          "Climate change and extreme weather events can pose significant risks. Develop a sustainability strategy, diversify your supply chain, and invest in resilient infrastructure to mitigate these impacts.",
      },
      {
        label: "No",
        quadrant: "Strength",
        response:
          "Fantastic! A lack of climate-related disruptions is a strength that supports operational stability. Continue monitoring environmental risks and implementing sustainable practices to maintain resilience.",
      },
      {
        label: "Unsure",
        quadrant: "Threat",
        response:
          "Uncertainty here suggests a need for risk assessment. Evaluate your exposure to climate risks and develop strategies to address potential disruptions.",
      },
    ],
  },
  {
    id: 68,
    question:
      "Have you formed strategic partnerships to enhance your market reach or capabilities (e.g. collaborations with suppliers, joint ventures, alliances with complementary businesses)?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Strategic partnerships are a key strength that enhances your market reach and capabilities. Continue to nurture these relationships and explore new opportunities for collaboration.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is a promising area for growth. Forming strategic partnerships can help you expand your reach, access new resources, and strengthen your competitive position. Identify potential partners that align with your goals.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for growth. Evaluate the benefits of strategic partnerships and consider pursuing collaborations to enhance your capabilities.",
      },
    ],
  },
  {
    id: 69,
    question:
      "Have you adopted new digital tools or platforms to gain a competitive edge?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Fantastic! Adopting new digital tools is a significant strength that enhances efficiency and competitiveness. Continue exploring emerging technologies to further optimize your operations.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is an area for growth. Digital tools can streamline processes, improve customer experience, and provide a competitive edge. Research tools that align with your business needs and consider implementing them.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Assess your current technology stack and explore opportunities to adopt digital tools that enhance your capabilities.",
      },
    ],
  },
  {
    id: 70,
    question: "Have you innovated based on unmet customer needs or feedback?",
    options: [
      {
        label: "Yes",
        quadrant: "Strength",
        response:
          "Great work! Innovating based on customer needs is a key strength that drives satisfaction and loyalty. Continue to gather feedback and use it to refine your offerings and stay ahead of competitors.",
      },
      {
        label: "No",
        quadrant: "Opportunity",
        response:
          "This is a promising area for growth. Customer feedback can provide valuable insights for innovation. Develop processes to collect and act on feedback to address unmet needs and enhance your offerings.",
      },
      {
        label: "Unsure",
        quadrant: "Opportunity",
        response:
          "Uncertainty here suggests potential for improvement. Evaluate your current approach to customer feedback and consider using it to drive innovation and meet evolving demands.",
      },
    ],
  },
  // {
  //   id: 71,
  //   question: "Have you acted on customer feedback to improve your business?",
  //   options: [
  //     {
  //       label: "Yes",
  //       quadrant: "Strength",
  //       response:
  //         "Excellent! Leveraging customer feedback to improve your business is a major strength. Keep refining your offerings based on insights from your customers to maintain a competitive edge.",
  //     },
  //     {
  //       label: "No",
  //       quadrant: "Opportunity",
  //       response:
  //         "This presents a valuable opportunity for growth. Customer feedback can provide actionable insights for improvement. Consider implementing a structured approach to gathering and acting on feedback.",
  //     },
  //     {
  //       label: "Unsure",
  //       quadrant: "Threat",
  //       response:
  //         "Uncertainty here may indicate a risk. If feedback isn’t properly utilized, you might miss important opportunities for improvement. Establish a process to assess and act on customer input to strengthen your business.",
  //     },
  //   ],
  // },
];

const Questionnaire = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    answers: ""
  });
  // console.log(formData)
  const [forAnswer, setForAnswer] = useState({});
  let user = formData.fullName;

  const totalQuestions = questionsData.length;
  // console.log(totalQuestions);
  // console.log(answers);
  // const handleAnswer = (selectedOption) => {
  //   console.log(
  //     selectedOption,
  //     questionsData[currentQuestionIndex].id,
  //     questionsData[currentQuestionIndex].question
  //   );
  //   setAnswers((prev) => ({
  //     ...prev,
  //     [currentQuestionIndex]: {
  //       questionId: questionsData[currentQuestionIndex].id,
  //       question: questionsData[currentQuestionIndex].question,
  //       id: selectedOption.id,
  //       selected: selectedOption.label,
  //       response: selectedOption.response,
  //       quadrant: selectedOption.quadrant,
  //     },
  //   }));

  //   if (currentQuestionIndex < totalQuestions - 1) {
  //     setTimeout(() => setCurrentQuestionIndex((prev) => prev + 1), 300);
  //   }
  // };

  // const handleAnswer = async (selectedOption) => {
  //   // Ensure that the answer for the current question is set before moving to the next
  //   console.log(
  //     selectedOption,
  //     questionsData[currentQuestionIndex].id,
  //     questionsData[currentQuestionIndex].question
  //   );

  //   // Update answers state for the current question
  //   await setAnswers((prev) => ({
  //     ...prev,
  //     [currentQuestionIndex]: {
  //       questionId: questionsData[currentQuestionIndex].id,
  //       question: questionsData[currentQuestionIndex].question,
  //       id: selectedOption.id,
  //       selected: selectedOption.label,
  //       response: selectedOption.response,
  //       quadrant: selectedOption.quadrant,
  //     },
  //   }));

  //   // Wait until the answer is set before moving to the next question
  //   if (currentQuestionIndex < totalQuestions - 1) {
  //     // Ensure that state updates are complete before moving on
  //     setTimeout(() => setCurrentQuestionIndex((prev) => prev + 1), 300);
  //   }
  // };

  // const handleAnswer = async (selectedOption) => {
  //   // Create the new answer object
  //   const newAnswer = {
  //     questionId: questionsData[currentQuestionIndex].id,
  //     question: questionsData[currentQuestionIndex].question,
  //     id: selectedOption.id,
  //     selected: selectedOption.label,
  //     response: selectedOption.response,
  //     quadrant: selectedOption.quadrant,
  //   };

  //   // Update answers state using the callback form to ensure we have the latest state
  //   const updatedAnswers = await new Promise((resolve) => {
  //     setAnswers((prevAnswers) => {
  //       const newAnswers = {
  //         ...prevAnswers,
  //         [currentQuestionIndex]: newAnswer,
  //       };
  //       resolve(newAnswers);
  //       return newAnswers;
  //     });
  //   });

  //   // Check if this was the last question
  //   if (currentQuestionIndex === totalQuestions - 1) {
  //     // All questions are answered, process the complete answers array
  //     console.log("Final answers:", updatedAnswers);
  //     // setShowResults(true); // Assuming you have this state for showing results
  //   } else {
  //     // Move to next question after a short delay to ensure state is updated
  //     setTimeout(() => {
  //       setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
  //     }, 300);
  //   }
  // };

  const handleAnswer = async (selectedOption) => {
    // Create the new answer object
    const newAnswer = {
      questionId: questionsData[currentQuestionIndex].id,
      question: questionsData[currentQuestionIndex].question,
      id: selectedOption.id,
      selected: selectedOption.label,
      response: selectedOption.response,
      quadrant: selectedOption.quadrant,
    };

    // Update answers state using the callback form to ensure we have the latest state
    const updatedAnswers = await new Promise((resolve) => {
      // console.log(currentQuestionIndex);
      setAnswers((prevAnswers) => {
        const newAnswers = {
          ...prevAnswers,
          [currentQuestionIndex]: newAnswer,
        };
        resolve(newAnswers);
        return newAnswers;
      });
    });

    // Check if this was the last question
    if (currentQuestionIndex === totalQuestions - 1) {
      // Verify all previous questions are answered before showing results
      const allQuestionsAnswered = Array.from({ length: totalQuestions }).every(
        (_, index) => updatedAnswers[index]?.questionId
      );

      if (allQuestionsAnswered) {
        console.log("Final answers:", updatedAnswers);
        // setShowResults(true);
      } else {
        // Find first unanswered question
        const firstUnansweredIndex = Array.from({
          length: totalQuestions,
        }).findIndex((_, index) => !updatedAnswers[index]?.questionId);
        setCurrentQuestionIndex(firstUnansweredIndex);
      }
    } else {
      // Check if the next question's previous question (current - 1) is answered
      const canProceed =
        currentQuestionIndex === 0 ||
        updatedAnswers[currentQuestionIndex - 1]?.questionId;

      if (canProceed) {
        // Move to next question after a short delay to ensure state is updated
        setTimeout(() => {
          setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
        }, 300);
      } else {
        // Go back to the unanswered previous question
        setCurrentQuestionIndex((prevIndex) => prevIndex - 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isFormValid = formData.fullName && formData.email && formData.phone;


  const handleSubmit = async () => {
    if (isFormValid) {
      setIsSubmitting(true);
      try {
        // Format answers into plain text
        const formattedAnswers = Object.values(answers)
          .map(
            (answer) =>
              `Question ${answer.questionId}: ${answer.question}\nAnswer: ${answer.selected}\nResponse: ${answer.response}\nQuadrant: ${answer.quadrant}\n\n`
          )
          .join("");

        // Update formData with formatted answers
        setFormData({ ...formData, answers: formattedAnswers });

        const response = await fetch(
          "https://services.leadconnectorhq.com/hooks/MJHmir5Xkxz4EWxcOEj3/webhook-trigger/23EaRw19TjCgaK8wGoJ3",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...formData, answers: formattedAnswers }),
          }
        );

        if (response.ok) {
          setIsSubmitted(true);
        } else {
          console.error("Error submitting form");
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (isSubmitted) {
    return <Results user={user} answers={answers} questions={questionsData} />;
  }

  return (
    <div className="inner">
      <div
        style={{
          alignItems: "center",
          padding: "40px",
          color: "white",
          height: "60px",
          width: "100%",
          position: "relative",
          top: "0px",
          left: "-400px",
          zIndex: 0,
          marginBottom: "-120px",
        }}
        className="headd"
      >
        <img
          src="./logo-white-2.png"
          alt="logo-img"
          width={188.78}
          height={48}
        />
        {/* <div className='flex flex-row' style={{
              fontSize: "1.5rem",
              fontFamily: "Lato",
              marginRight: "80px",
          }}>
             SWOTIFY 
          </div> */}
        <div></div>
      </div>
      {currentQuestionIndex === totalQuestions - 1 && (
        <div
          style={{
            alignItems: "center",
            padding: "40px",
            color: "white",
            height: "60px",
            width: "100%",
            position: "relative",
            top: "0px",
            left: "-400px",
            zIndex: 0,
            marginBottom: "-120px",
          }}
          className="headd"
        >
          <img
            src="./logo-white-2.png"
            alt="logo-img"
            width={188.78}
            height={48}
          />
          <div></div>
        </div>
      )}
      <div
        className="main"
        style={{
          width: "600px",
          margin: "100px auto",
          padding: "24px",
          borderRadius: "8px",
        }}
      >
        <ProgressBar
          progress={(currentQuestionIndex + 1) / totalQuestions}
          currentStep={currentQuestionIndex + 1}
          totalSteps={totalQuestions}
        />

        <Question
          question={questionsData[currentQuestionIndex]}
          onAnswer={handleAnswer}
          selectedAnswer={answers[currentQuestionIndex]?.selected}
        />

        {currentQuestionIndex === totalQuestions - 1 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              marginTop: "16px",
            }}
          >
            <h3 style={{ color: "white" }}>Enter Your Details</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "flex-start",
              }}
              className="formm"
            >
              <input
                type="text"
                name="fullName"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleFormChange}
                style={{ color: "white" }}
                required
              />
              <br />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleFormChange}
                style={{ color: "white" }}
                required
              />
              <br />
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleFormChange}
                style={{ color: "white" }}
                required
              />
            </div>
            <br />
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            marginTop: "16px",
          }}
        >
          <button
            className="prev"
            style={{
              padding: "8px 16px",
              backgroundColor: "#E5E7EB",
              cursor: currentQuestionIndex === 0 ? "not-allowed" : "pointer",
              opacity: currentQuestionIndex === 0 ? 0.5 : 1,
            }}
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </button>

          {currentQuestionIndex === totalQuestions - 1 && (
            <button
              style={{
                padding: "8px 16px",
                background: "linear-gradient(to right, #16133d, #6357a5)",
                color: "white",
                marginLeft: "10px",
                borderRadius: "50px",
                width: "200px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: (isFormValid && !isSubmitting) ? "pointer" : "not-allowed",
                opacity: (isFormValid && !isSubmitting) ? 1 : 0.5,
              }}
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export default Questionnaire;
