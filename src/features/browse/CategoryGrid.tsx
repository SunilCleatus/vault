type Props = {
  categories: Record<string, string>;
  onSelectCategory: (category: string, folderId: string) => void;
};

export default function CategoryGrid({ categories, onSelectCategory }: Props) {
  return (
    <div className="category-grid">
      {Object.entries(categories).map(([category, folderId]) => (
        <button
          key={category}
          className="category-tile"
          onClick={() => onSelectCategory(category, folderId)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
