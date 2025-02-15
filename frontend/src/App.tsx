// frontend/src/App.tsx
import React, { useEffect, useState } from "react";
import { MealPlan, SwapMealResponse } from "./types";

const App: React.FC = () => {
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [shoppingList, setShoppingList] = useState<string[]>([]);

    // Fetch the meal plan on mount
    useEffect(() => {
        fetch("/api/mealplan")
            .then((res) => res.json())
            .then((data: MealPlan) => setMealPlan(data))
            .catch((err) => console.error("Error fetching meal plan:", err));
    }, []);

    const finalizePlan = () => {
        // In a real implementation, include a mapping of day -> meal ID.
        fetch("/api/mealplan/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: {} })
        })
            .then((res) => res.text())
            .then((text) => alert(text))
            .catch((err) => console.error("Error finalizing plan:", err));
    };

    const swapMeal = (day: string) => {
        fetch("/api/mealplan/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day, meal_id: 0 })
        })
            .then((res) => res.json())
            .then((data: SwapMealResponse) =>
                alert(`Swapped ${day} with: ${data.meal_name} (ID: ${data.new_meal_id})`)
            )
            .catch((err) => console.error("Error swapping meal:", err));
    };

    const getShoppingList = () => {
        fetch("/api/shoppinglist")
            .then((res) => res.json())
            .then((data: string[]) => setShoppingList(data))
            .catch((err) => console.error("Error fetching shopping list:", err));
    };

    return (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
            <h1>Weekly Meal Plan</h1>
            {mealPlan ? (
                <table border={1} cellPadding={5}>
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Meal</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(mealPlan).map(([day, meal]) => (
                            <tr key={day}>
                                <td>{day}</td>
                                <td>{meal}</td>
                                <td>
                                    {day !== "Friday" && meal !== "Eating out" && (
                                        <button onClick={() => swapMeal(day)}>Swap Meal</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>Loading meal plan...</p>
            )}
            <div style={{ marginTop: "20px" }}>
                <button onClick={finalizePlan}>Finalize Meal Plan</button>
                <button onClick={getShoppingList} style={{ marginLeft: "10px" }}>
                    Get Shopping List
                </button>
            </div>
            {shoppingList.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                    <h2>Shopping List</h2>
                    <ul>
                        {shoppingList.map((item, index) => (
                            <li key={index}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default App;