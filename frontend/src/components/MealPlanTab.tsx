import React, { useEffect, useState } from "react";
import { MealPlan, Meal } from "../types";

interface MealPlanTabProps {
    showToast: (message: string) => void;
}

export const MealPlanTab: React.FC<MealPlanTabProps> = ({ showToast }) => {
    const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
    const [shoppingList, setShoppingList] = useState<string[]>([]);

    useEffect(() => {
        fetch("/api/mealplan")
            .then((res) => res.json())
            .then((data: MealPlan) => setMealPlan(data))
            .catch((err) => console.error("Error fetching meal plan:", err));
    }, []);

    const finalizePlan = () => {
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
        const currentMeal = mealPlan ? mealPlan[day] : null;
        if (!currentMeal) return;
        fetch("/api/meals/swap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meal_id: currentMeal.id }),
        })
            .then((res) => res.json())
            .then((newMeal: Meal) => {
                setMealPlan({ ...mealPlan, [day]: newMeal });
                setShoppingList([]);
                showToast(`Swapped ${day} with: ${newMeal.mealName} (ID: ${newMeal.id})`);
            })
            .catch((err) => console.error("Error swapping meal:", err));
    };

    const getShoppingList = () => {
        if (!mealPlan) return;
        const mealIDs = Object.values(mealPlan).map((meal) => meal.id);
        fetch("/api/shoppinglist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: mealIDs }),
        })
            .then((res) => res.json())
            .then((data: string[]) => setShoppingList(data))
            .catch((err) => console.error(err));
    };

    return (
        <div>
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
                                <td>{meal.mealName}</td>
                                <td>
                                    {day !== "Friday" && meal.mealName !== "Eating out" && (
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