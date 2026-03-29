import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Category, Question } from '../types';
import { Database, Play, CheckCircle2, Circle, Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const LOCAL_STORAGE_KEY = 'agribank_quiz_local_questions';

export default function Setup() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [limit, setLimit] = useState(100);
  const [time, setTime] = useState(100);
  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [localQuestions, setLocalQuestions] = useState<Question[]>([]);
  const [useLocalBank, setUseLocalBank] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const catSnap = await getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'desc')));
        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) } as Category));
        setCategories(cats);

        const qSnap = await getDocs(collection(db, 'questions'));
        setTotalQuestions(qSnap.size);

        const savedLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedLocal) {
          setLocalQuestions(JSON.parse(savedLocal));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast.error("File Excel trống");
          return;
        }

        const newQuestions: Question[] = jsonData.map((row, index) => {
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          });

          return {
            id: `local-${Date.now()}-${index}`,
            categoryId: 'local',
            question: (normalizedRow.question || normalizedRow['câu hỏi'] || "").toString(),
            a: (normalizedRow.a || normalizedRow['đáp án a'] || "").toString(),
            b: (normalizedRow.b || normalizedRow['đáp án b'] || "").toString(),
            c: (normalizedRow.c || normalizedRow['đáp án c'] || "").toString(),
            d: (normalizedRow.d || normalizedRow['đáp án d'] || "").toString(),
            answer: (normalizedRow.answer || normalizedRow['đáp án đúng'] || "").toString().toUpperCase().trim(),
            createdAt: new Date().toISOString()
          };
        }).filter(q => q.question && q.answer && q.a);

        const updatedLocal = [...localQuestions, ...newQuestions];
        setLocalQuestions(updatedLocal);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLocal));
        setUseLocalBank(true);
        toast.success(`Đã nạp thành công ${newQuestions.length} câu vào kho riêng!`);
      } catch (error) {
        console.error("Error uploading local questions:", error);
        toast.error("Lỗi khi xử lý file Excel");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearLocalQuestions = () => {
    if (window.confirm("Xóa toàn bộ câu hỏi trong kho riêng của bạn?")) {
      setLocalQuestions([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setUseLocalBank(false);
      toast.success("Đã xóa kho câu hỏi riêng");
    }
  };

  const handleStart = () => {
    if (totalQuestions === 0 && localQuestions.length === 0) {
      toast.error("Kho câu hỏi hiện đang trống");
      return;
    }
    navigate('/quiz', { state: { selectedCategories, limit, time, useLocalBank, localQuestions: useLocalBank ? localQuestions : [] } });
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-agri-red"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ngân hàng câu hỏi hệ thống</p>
          <p className="text-2xl font-black text-agri-green">{totalQuestions} Câu có sẵn</p>
        </div>
        <Database className="text-agri-green opacity-20" size={40} />
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Kho câu hỏi riêng của bạn</p>
            <p className="text-xl font-black text-blue-600">{localQuestions.length} Câu đã nạp</p>
          </div>
          <div className="flex gap-2">
            <label className="p-2 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition">
              <Upload size={20} />
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
            </label>
            {localQuestions.length > 0 && (
              <button onClick={clearLocalQuestions} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition">
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
        
        {localQuestions.length > 0 && (
          <button
            onClick={() => setUseLocalBank(!useLocalBank)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
              useLocalBank ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText className={useLocalBank ? 'text-blue-500' : 'text-slate-400'} size={20} />
              <span className={`font-bold ${useLocalBank ? 'text-blue-600' : 'text-slate-600'}`}>
                Sử dụng kho câu hỏi riêng
              </span>
            </div>
            {useLocalBank ? <CheckCircle2 className="text-blue-500" size={20} /> : <Circle className="text-slate-200" size={20} />}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Chọn lĩnh vực hệ thống</p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setSelectedCategories([])}
            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
              selectedCategories.length === 0 ? 'border-agri-red bg-red-50' : 'border-slate-100 bg-white'
            }`}
          >
            <span className={`font-bold ${selectedCategories.length === 0 ? 'text-agri-red' : 'text-slate-600'}`}>
              Tất cả các lĩnh vực hệ thống
            </span>
            {selectedCategories.length === 0 ? <CheckCircle2 className="text-agri-red" size={20} /> : <Circle className="text-slate-200" size={20} />}
          </button>
          
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                selectedCategories.includes(cat.id) ? 'border-agri-red bg-red-50' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="text-left">
                <p className={`font-bold ${selectedCategories.includes(cat.id) ? 'text-agri-red' : 'text-slate-600'}`}>
                  {cat.name}
                </p>
                {cat.description && <p className="text-xs text-slate-400">{cat.description}</p>}
              </div>
              {selectedCategories.includes(cat.id) ? <CheckCircle2 className="text-agri-red" size={20} /> : <Circle className="text-slate-200" size={20} />}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-400 uppercase text-center">Số câu hỏi</label>
          <input 
            type="number" 
            value={limit} 
            onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
            className="w-full border-b-2 border-gray-100 p-2 outline-none focus:border-agri-red font-bold text-xl text-center"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-black text-gray-400 uppercase text-center">Số phút</label>
          <input 
            type="number" 
            value={time} 
            onChange={(e) => setTime(parseInt(e.target.value) || 0)}
            className="w-full border-b-2 border-gray-100 p-2 outline-none focus:border-agri-red font-bold text-xl text-center"
          />
        </div>
      </div>

      <button 
        onClick={handleStart}
        disabled={totalQuestions === 0 && localQuestions.length === 0}
        className="w-full bg-agri-red text-white text-sm font-bold py-4 rounded-2xl shadow-lg disabled:opacity-30 disabled:grayscale active:scale-95 transition uppercase tracking-widest flex items-center justify-center gap-2"
      >
        <Play size={18} fill="currentColor" />
        Bắt đầu làm bài
      </button>

      <p className="text-[10px] text-gray-400 text-center italic">
        Dữ liệu được cập nhật từ hệ thống quản trị và kho riêng của bạn
      </p>
    </div>
  );
}
