import React from 'react';
import Link from 'next/link';
import { BookCardProps } from '@/types';
import Image from 'next/image';

const BookCard = ({ title, author, coverURL, slug }: BookCardProps) => {
  return (
    <Link href={`/books/${slug}`}>
        <article className="book-card">
            <figure className="book-card-figure">
                <div className="book-card-cover-wrapper">
                    <Image src={coverURL} alt={title} width={133} height={200} className="book-name-cover"></Image>
                </div>
            </figure>
        </article>
    </Link>
  );
};

export default BookCard;