// ColorFeedback.jsx
import React, { useState, useEffect } from 'react';

const ColorFeedback = () => {
  const [feedback, setFeedback] = useState('');

  const colors = [
    { name: 'Red', value: '#FF0000' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
  ];

  // Helper function to convert hex color to an integer value
  const hexToInt = (hex) => parseInt(hex.slice(1), 16);

  // Find the color with the highest value
  const getHighestColor = () =>
    colors.reduce((max, color) =>
      hexToInt(color.value) > hexToInt(max.value) ? color : max
    );

  // Generate feedback message based on the highest color value
  useEffect(() => {
    const highestColor = getHighestColor();
    setFeedback(
      `🎨 The color with the highest value is ${highestColor.name} (${highestColor.value}).`
    );
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Color List</h1>
      <table className="min-w-full border-collapse border border-gray-300 mb-4">
        <thead>
          <tr>
            <th className="border border-gray-300 px-4 py-2 text-left">Color</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Value</th>
            <th className="border border-gray-300 px-4 py-2 text-left">Preview</th>
          </tr>
        </thead>
        <tbody>
          {colors.map((color, index) => (
            <tr key={index}>
              <td className="border border-gray-300 px-4 py-2">{color.name}</td>
              <td className="border border-gray-300 px-4 py-2">{color.value}</td>
              <td className="border border-gray-300 px-4 py-2">
                <div
                  style={{
                    backgroundColor: color.value,
                    width: '30px',
                    height: '30px',
                    borderRadius: '4px',
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Feedback Section */}
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: '#f9f9f9',
        }}
      >
        <h3 className="text-lg font-bold">Feedback</h3>
        <p>{feedback}</p>
      </div>
    </div>
  );
};

export default ColorFeedback;
